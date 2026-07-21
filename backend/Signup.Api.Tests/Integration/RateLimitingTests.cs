using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Signup.Api.Data;
using Signup.Api.Models;

namespace Signup.Api.Tests.Integration;

/// <summary>
/// Verifies AC #16 (basic abuse protection) using its own WebApplicationFactory instance
/// configured (via the RateLimiting__* environment variables Program.cs reads) with a
/// deliberately tiny permit limit, so it doesn't interfere with (or get interfered with
/// by) the shared SignupApiFactory used by the rest of the functional integration tests.
/// Test collection parallelization is disabled for this assembly (see
/// CollectionBehaviorSettings.cs) specifically so these process-wide environment
/// variable overrides can't race between test classes.
/// </summary>
public class RateLimitingTests
{
    private sealed class TightlyRateLimitedFactory : WebApplicationFactory<Program>
    {
        public TightlyRateLimitedFactory()
        {
            Environment.SetEnvironmentVariable("RateLimiting__SignupPermitLimit", "2");
            Environment.SetEnvironmentVariable("RateLimiting__SignupWindowSeconds", "60");
        }

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.UseEnvironment("Testing");

            builder.ConfigureServices(services =>
            {
                services.AddDbContext<AppDbContext>(options =>
                    options.UseInMemoryDatabase(Guid.NewGuid().ToString()));
            });
        }
    }

    [Fact]
    public async Task Post_Signup_Returns429_AfterExceedingPermitLimit()
    {
        using var factory = new TightlyRateLimitedFactory();
        var client = factory.CreateClient();

        SignupRequest MakeRequest(int i) => new()
        {
            FullName = $"Rate Limited User {i}",
            Email = $"rate.limited.{i}@example.com",
            Password = "Password1",
            ConfirmPassword = "Password1",
        };

        var firstTwoResponses = new List<HttpResponseMessage>
        {
            await client.PostAsJsonAsync("/api/signup", MakeRequest(1)),
            await client.PostAsJsonAsync("/api/signup", MakeRequest(2)),
        };

        Assert.All(firstTwoResponses, r => Assert.NotEqual(HttpStatusCode.TooManyRequests, r.StatusCode));

        var thirdResponse = await client.PostAsJsonAsync("/api/signup", MakeRequest(3));

        Assert.Equal(HttpStatusCode.TooManyRequests, thirdResponse.StatusCode);

        // Reset back to a generous limit so any subsequently-created factory in this
        // process (e.g. if test ordering changes) isn't left with a 2-request ceiling.
        Environment.SetEnvironmentVariable("RateLimiting__SignupPermitLimit", "100000");
    }
}
