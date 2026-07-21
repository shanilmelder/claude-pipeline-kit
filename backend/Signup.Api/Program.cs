using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Signup.Api.Data;
using Signup.Api.Services;

var builder = WebApplication.CreateBuilder(args);

// Add services to the container.
builder.Services.AddControllers();

// Learn more about configuring OpenAPI at https://aka.ms/aspnet/openapi
builder.Services.AddOpenApi();

// The "Testing" environment is used by WebApplicationFactory-based integration tests
// (see Signup.Api.Tests/Integration/SignupApiFactory.cs), which supply their own
// EF Core InMemory-backed AppDbContext registration instead. Registering Npgsql here
// unconditionally would make EF Core see two competing database providers registered
// in the same service collection and throw at request time.
if (!builder.Environment.IsEnvironment("Testing"))
{
    builder.Services.AddDbContext<AppDbContext>(options =>
        options.UseNpgsql(builder.Configuration.GetConnectionString("DefaultConnection")));
}

builder.Services.AddScoped<IPasswordHasher, BcryptPasswordHasher>();
builder.Services.AddScoped<ISignupService, SignupService>();

// AC #16: basic abuse protection on the signup endpoint. This is a lightweight starting
// point (in-process fixed window, per client IP) — NOT production-grade rate limiting.
// A production deployment behind multiple instances would need a shared store (e.g.
// Redis-backed limiter) instead of this in-memory one. Configurable so tests can use a
// tighter/looser window than production (see appsettings.json "RateLimiting" section and
// Signup.Api.Tests/Integration/RateLimitingTests.cs).
var signupPermitLimit = builder.Configuration.GetValue("RateLimiting:SignupPermitLimit", 5);
var signupWindowSeconds = builder.Configuration.GetValue("RateLimiting:SignupWindowSeconds", 60);

builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;

    options.AddPolicy("signup", httpContext =>
        RateLimitPartition.GetFixedWindowLimiter(
            partitionKey: httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown",
            factory: _ => new FixedWindowRateLimiterOptions
            {
                PermitLimit = signupPermitLimit,
                Window = TimeSpan.FromSeconds(signupWindowSeconds),
                QueueLimit = 0,
                QueueProcessingOrder = QueueProcessingOrder.OldestFirst,
            }));
});

var app = builder.Build();

// Configure the HTTP request pipeline.
if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
}

app.UseHttpsRedirection();

app.UseRateLimiter();

app.MapControllers();

app.Run();

// Exposed for WebApplicationFactory<Program> in integration tests.
public partial class Program
{
}
