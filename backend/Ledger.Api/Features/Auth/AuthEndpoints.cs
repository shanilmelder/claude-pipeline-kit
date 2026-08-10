using System.Security.Claims;
using Ledger.Api.Data;
using Ledger.Api.Domain;
using Ledger.Api.Services;
using Ledger.Api.Validation;
using Microsoft.AspNetCore.Authorization;
using Microsoft.EntityFrameworkCore;
using Npgsql;

namespace Ledger.Api.Features.Auth;

public static class AuthEndpoints
{
    private const string InvalidCredentialsMessage = "Invalid email or password.";

    public static IEndpointRouteBuilder MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/auth").WithTags("Auth");

        group.MapPost("/register", RegisterAsync).AllowAnonymous();
        group.MapPost("/login", LoginAsync).AllowAnonymous();
        group.MapGet("/me", GetMe);
        group.MapPost("/logout", Logout);

        return app;
    }

    private static async Task<IResult> RegisterAsync(
        RegisterRequest request,
        LedgerDbContext db,
        IPasswordHasher passwordHasher,
        IJwtTokenService tokenService,
        CancellationToken cancellationToken)
    {
        if (!RequestValidator.TryValidate(request, out var errors))
        {
            return Results.ValidationProblem(errors);
        }

        var email = Normalize(request.Email);

        if (await db.Users.AnyAsync(u => u.Email == email, cancellationToken))
        {
            return EmailAlreadyRegistered();
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            Email = email,
            PasswordHash = passwordHasher.Hash(request.Password),
            CreatedAt = DateTime.UtcNow,
        };

        db.Users.Add(user);

        try
        {
            await db.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex) when (IsUniqueViolation(ex))
        {
            // Lost a race against a concurrent registration for the same email.
            // The unique index did its job; report it as a conflict, not a 500.
            return EmailAlreadyRegistered();
        }

        var response = new AuthResponse(tokenService.CreateToken(user), ToUserResponse(user));
        return Results.Created($"/api/users/{user.Id}", response);
    }

    private static async Task<IResult> LoginAsync(
        LoginRequest request,
        LedgerDbContext db,
        IPasswordHasher passwordHasher,
        IJwtTokenService tokenService,
        CancellationToken cancellationToken)
    {
        if (!RequestValidator.TryValidate(request, out var errors))
        {
            return Results.ValidationProblem(errors);
        }

        var email = Normalize(request.Email);
        var user = await db.Users.FirstOrDefaultAsync(u => u.Email == email, cancellationToken);

        // An unknown email and a wrong password return exactly the same response
        // so the endpoint cannot be used to enumerate registered users.
        if (user is null || !passwordHasher.Verify(request.Password, user.PasswordHash))
        {
            return Results.Problem(
                title: "Invalid email or password",
                detail: InvalidCredentialsMessage,
                statusCode: StatusCodes.Status401Unauthorized);
        }

        var response = new AuthResponse(tokenService.CreateToken(user), ToUserResponse(user));
        return Results.Ok(response);
    }

    private static async Task<IResult> GetMe(
        ClaimsPrincipal principal,
        LedgerDbContext db,
        CancellationToken cancellationToken)
    {
        if (!Guid.TryParse(principal.FindFirstValue("sub"), out var userId))
        {
            return Results.Unauthorized();
        }

        var user = await db.Users
            .AsNoTracking()
            .FirstOrDefaultAsync(u => u.Id == userId, cancellationToken);

        return user is null
            ? Results.Unauthorized()
            : Results.Ok(ToUserResponse(user));
    }

    /// <summary>
    /// Tokens are stateless, so logout is a client-side discard. The endpoint
    /// exists (and requires a token) purely so the client has something to call.
    /// </summary>
    private static IResult Logout() => Results.NoContent();

    /// <summary>PostgreSQL SQLSTATE 23505 = unique_violation.</summary>
    private static bool IsUniqueViolation(DbUpdateException ex) =>
        ex.InnerException is PostgresException { SqlState: PostgresErrorCodes.UniqueViolation };

    private static IResult EmailAlreadyRegistered() => Results.Problem(
        title: "Email already registered",
        detail: "An account with that email address already exists.",
        statusCode: StatusCodes.Status409Conflict);

    private static string Normalize(string email) => email.Trim().ToLowerInvariant();

    private static UserResponse ToUserResponse(User user) => new(user.Id.ToString(), user.Email);
}
