using System.Net;
using System.Net.Http.Json;
using Microsoft.Extensions.DependencyInjection;
using Signup.Api.Data;
using Signup.Api.Models;

namespace Signup.Api.Tests.Integration;

public class SignupEndpointTests : IClassFixture<SignupApiFactory>
{
    private readonly SignupApiFactory _factory;

    public SignupEndpointTests(SignupApiFactory factory)
    {
        _factory = factory;
    }

    [Fact]
    public async Task Post_Signup_EndToEnd_PersistsUser_WithHashedPassword_AndReturns201()
    {
        var client = _factory.CreateClient();
        var request = new SignupRequest
        {
            FullName = "Grace Hopper",
            Email = "grace.hopper@example.com",
            Password = "Password1",
            ConfirmPassword = "Password1",
        };

        var response = await client.PostAsJsonAsync("/api/signup", request);

        Assert.Equal(HttpStatusCode.Created, response.StatusCode);

        var body = await response.Content.ReadFromJsonAsync<SignupResponse>();
        Assert.NotNull(body);
        Assert.Equal("grace.hopper@example.com", body!.Email);
        Assert.Equal("Grace Hopper", body.FullName);
        Assert.NotEqual(Guid.Empty, body.Id);

        // The response body must never include the password/hash at all — assert on the
        // raw JSON, not just the strongly-typed model, so a future field addition can't
        // silently leak it either.
        var rawResponseJson = await (await client.PostAsJsonAsync("/api/signup", new SignupRequest
        {
            FullName = "Second User",
            Email = "second.user@example.com",
            Password = "Password2",
            ConfirmPassword = "Password2",
        })).Content.ReadAsStringAsync();
        Assert.DoesNotContain("password", rawResponseJson, StringComparison.OrdinalIgnoreCase);

        // Verify actual DB persistence (AC: signup -> record persisted -> password hashed).
        using var scope = _factory.Services.CreateScope();
        var dbContext = scope.ServiceProvider.GetRequiredService<AppDbContext>();
        var persisted = dbContext.Users.Single(u => u.Email == "grace.hopper@example.com");

        Assert.NotEqual("Password1", persisted.PasswordHash);
        Assert.StartsWith("$2", persisted.PasswordHash);
        Assert.True(BCrypt.Net.BCrypt.Verify("Password1", persisted.PasswordHash));
    }

    [Fact]
    public async Task Post_Signup_ReturnsConflict_ForDuplicateEmail()
    {
        var client = _factory.CreateClient();
        var request = new SignupRequest
        {
            FullName = "Original User",
            Email = "duplicate.endpoint@example.com",
            Password = "Password1",
            ConfirmPassword = "Password1",
        };

        var first = await client.PostAsJsonAsync("/api/signup", request);
        Assert.Equal(HttpStatusCode.Created, first.StatusCode);

        var second = await client.PostAsJsonAsync("/api/signup", request);

        Assert.Equal(HttpStatusCode.Conflict, second.StatusCode);
        var errorBody = await second.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(errorBody);
        Assert.Equal("An account with this email already exists.", errorBody!.Error);
    }

    [Fact]
    public async Task Post_Signup_ReturnsBadRequest_ForWeakPassword()
    {
        var client = _factory.CreateClient();
        var request = new SignupRequest
        {
            FullName = "Weak Password User",
            Email = "weak.password@example.com",
            Password = "weak",
            ConfirmPassword = "weak",
        };

        var response = await client.PostAsJsonAsync("/api/signup", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        var errorBody = await response.Content.ReadFromJsonAsync<ErrorResponse>();
        Assert.NotNull(errorBody);
        Assert.False(string.IsNullOrWhiteSpace(errorBody!.Error));
    }

    [Fact]
    public async Task Post_Signup_ReturnsBadRequest_ForMissingFields()
    {
        var client = _factory.CreateClient();
        var request = new SignupRequest
        {
            FullName = "",
            Email = "missing.fields@example.com",
            Password = "Password1",
            ConfirmPassword = "Password1",
        };

        var response = await client.PostAsJsonAsync("/api/signup", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Post_Signup_ReturnsBadRequest_ForInvalidEmailFormat()
    {
        var client = _factory.CreateClient();
        var request = new SignupRequest
        {
            FullName = "Invalid Email User",
            Email = "not-a-valid-email",
            Password = "Password1",
            ConfirmPassword = "Password1",
        };

        var response = await client.PostAsJsonAsync("/api/signup", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }

    [Fact]
    public async Task Post_Signup_ReturnsBadRequest_WhenPasswordsDoNotMatch()
    {
        var client = _factory.CreateClient();
        var request = new SignupRequest
        {
            FullName = "Mismatch User",
            Email = "mismatch@example.com",
            Password = "Password1",
            ConfirmPassword = "Password2",
        };

        var response = await client.PostAsJsonAsync("/api/signup", request);

        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
    }
}
