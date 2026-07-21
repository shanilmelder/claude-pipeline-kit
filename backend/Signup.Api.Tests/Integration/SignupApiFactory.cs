using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Signup.Api.Data;

namespace Signup.Api.Tests.Integration;

/// <summary>
/// Boots the real ASP.NET Core pipeline (controllers, middleware, rate limiting) via
/// WebApplicationFactory, but swaps the Npgsql-backed AppDbContext for an EF Core
/// InMemory database so the test suite doesn't require a running PostgreSQL instance.
/// Uses the "Testing" ASPNETCORE_ENVIRONMENT, which Program.cs checks to skip its own
/// Npgsql registration (see Program.cs comment) — without that, EF Core would see two
/// competing database providers registered and throw.
///
/// Also raises the signup rate limit's permit count via the RateLimiting__* environment
/// variables (read by Program.cs through configuration) so the many requests fired
/// across this shared test class fixture don't 429 each other. Rate limiting itself is
/// covered separately and deliberately with a low limit in RateLimitingTests.cs, using
/// its own factory instance — since environment variables are process-wide, and could
/// otherwise race with this class's, test collection parallelization is disabled for
/// this assembly (see CollectionBehaviorSettings.cs).
///
/// Documented deviation: the research brief's ideal integration test would run against
/// a real PostgreSQL 18 (e.g. via Testcontainers) to also prove the database-level
/// unique constraint. Docker wasn't available in the sandbox this was authored in, so
/// this test proves the full HTTP -> service -> EF Core -> persisted-row flow and that
/// the stored password is hashed, using InMemory as the DB substitute. The unique
/// constraint itself is asserted structurally via the AppDbContext model configuration
/// and the generated migration (Migrations/20260721202110_InitialCreate.cs), and via the
/// case-insensitive-duplicate unit test in Unit/SignupServiceTests.cs.
/// </summary>
public class SignupApiFactory : WebApplicationFactory<Program>
{
    public string DatabaseName { get; } = Guid.NewGuid().ToString();

    public SignupApiFactory()
    {
        // Read by Program.cs via IConfiguration (environment variables are layered
        // after appsettings.json by the default ASP.NET Core configuration chain, so
        // this reliably overrides the appsettings.json defaults for this process).
        Environment.SetEnvironmentVariable("RateLimiting__SignupPermitLimit", "100000");
        Environment.SetEnvironmentVariable("RateLimiting__SignupWindowSeconds", "60");
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Testing");

        builder.ConfigureServices(services =>
        {
            services.AddDbContext<AppDbContext>(options =>
                options.UseInMemoryDatabase(DatabaseName));
        });
    }
}
