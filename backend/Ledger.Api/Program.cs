using System.Text;
using Ledger.Api.Data;
using Ledger.Api.Features.Auth;
using Ledger.Api.Features.Categories;
using Ledger.Api.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

const string WebCorsPolicy = "ledger-web";

builder.Services.AddDbContext<LedgerDbContext>(options =>
    options.UseNpgsql(builder.Configuration.GetConnectionString("Ledger")));

builder.Services.Configure<JwtOptions>(builder.Configuration.GetSection(JwtOptions.SectionName));
builder.Services.AddSingleton<IPasswordHasher, PasswordHasher>();
builder.Services.AddSingleton<IJwtTokenService, JwtTokenService>();

var jwt = builder.Configuration.GetSection(JwtOptions.SectionName).Get<JwtOptions>() ?? new JwtOptions();

if (string.IsNullOrWhiteSpace(jwt.Key))
{
    throw new InvalidOperationException(
        "Jwt:Key is not configured. Supply it via environment variable (Jwt__Key) or user-secrets.");
}

builder.Services
    .AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        // Keep the raw claim names ("sub", "email") instead of the legacy
        // WS-Federation URIs the handler maps to by default.
        options.MapInboundClaims = false;
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidIssuer = jwt.Issuer,
            ValidateAudience = true,
            ValidAudience = jwt.Audience,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwt.Key)),
            ClockSkew = TimeSpan.Zero,
            NameClaimType = "sub",
        };
    });

// Protected by default: every endpoint requires a token unless it opts out
// with AllowAnonymous. New endpoints are therefore secure by omission.
builder.Services.AddAuthorization(options =>
{
    options.FallbackPolicy = new AuthorizationPolicyBuilder()
        .RequireAuthenticatedUser()
        .Build();
});

builder.Services.AddCors(options =>
{
    options.AddPolicy(WebCorsPolicy, policy => policy
        .WithOrigins(builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
                     ?? ["http://localhost:5173"])
        .AllowAnyHeader()
        .AllowAnyMethod());
});

// Turns unhandled exceptions and bare status codes into RFC 7807 responses.
builder.Services.AddProblemDetails();

var app = builder.Build();

app.UseExceptionHandler();
app.UseStatusCodePages();

app.UseCors(WebCorsPolicy);
app.UseAuthentication();
app.UseAuthorization();

app.MapAuthEndpoints();
app.MapCategoryEndpoints();

app.Run();
