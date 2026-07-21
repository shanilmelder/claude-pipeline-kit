using Microsoft.EntityFrameworkCore;
using Signup.Api.Data;
using Signup.Api.Models;

namespace Signup.Api.Services;

public class SignupService : ISignupService
{
    private readonly AppDbContext _dbContext;
    private readonly IPasswordHasher _passwordHasher;
    private readonly ILogger<SignupService> _logger;

    public SignupService(AppDbContext dbContext, IPasswordHasher passwordHasher, ILogger<SignupService> logger)
    {
        _dbContext = dbContext;
        _passwordHasher = passwordHasher;
        _logger = logger;
    }

    public async Task<SignupResult> SignUpAsync(SignupRequest request, CancellationToken cancellationToken = default)
    {
        var validationError = SignupValidator.Validate(request);
        if (validationError is not null)
        {
            return SignupResult.ValidationFailed(validationError);
        }

        // Normalize email to lowercase/trimmed so uniqueness (and lookups) are
        // case-insensitive (documented "your call" item from the research brief).
        var normalizedEmail = request.Email!.Trim().ToLowerInvariant();

        var emailAlreadyExists = await _dbContext.Users
            .AsNoTracking()
            .AnyAsync(u => u.Email == normalizedEmail, cancellationToken);

        if (emailAlreadyExists)
        {
            return SignupResult.DuplicateEmailError("An account with this email already exists.");
        }

        var user = new User
        {
            Id = Guid.NewGuid(),
            FullName = request.FullName!.Trim(),
            Email = normalizedEmail,
            PasswordHash = _passwordHasher.Hash(request.Password!),
            CreatedAt = DateTimeOffset.UtcNow,
        };

        _dbContext.Users.Add(user);

        try
        {
            await _dbContext.SaveChangesAsync(cancellationToken);
        }
        catch (DbUpdateException ex)
        {
            // Covers the race where two requests for the same email pass the pre-check
            // above concurrently — the database-level unique constraint (AC #18) is the
            // real source of truth here, not the AnyAsync check above.
            _logger.LogWarning(ex, "Signup failed unique constraint check for a normalized email");
            return SignupResult.DuplicateEmailError("An account with this email already exists.");
        }

        _logger.LogInformation("New user account created with id {UserId}", user.Id);

        return SignupResult.Success(new SignupResponse
        {
            Id = user.Id,
            FullName = user.FullName,
            Email = user.Email,
            CreatedAt = user.CreatedAt,
        });
    }
}
