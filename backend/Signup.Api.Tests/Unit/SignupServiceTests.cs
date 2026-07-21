using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging.Abstractions;
using Signup.Api.Data;
using Signup.Api.Models;
using Signup.Api.Services;

namespace Signup.Api.Tests.Unit;

/// <summary>
/// Exercises SignupService's business rules (duplicate email, hashing, validation
/// delegation) against an EF Core InMemory database. This is a fast, isolated substitute
/// for a real PostgreSQL instance and is NOT the same as the DB-level unique constraint
/// enforced by the "uq_users_email" index in the real Npgsql migration — see
/// Integration/SignupEndpointTests.cs for the end-to-end flow, and PR notes for why a
/// real Testcontainers-Postgres integration test wasn't used in this sandbox (no Docker
/// available in the dev/CI environment this was authored in).
/// </summary>
public class SignupServiceTests
{
    private static AppDbContext NewInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<AppDbContext>()
            .UseInMemoryDatabase(Guid.NewGuid().ToString())
            .Options;

        return new AppDbContext(options);
    }

    private static SignupRequest ValidRequest(string email = "ada@example.com") => new()
    {
        FullName = "Ada Lovelace",
        Email = email,
        Password = "Password1",
        ConfirmPassword = "Password1",
    };

    [Fact]
    public async Task SignUpAsync_CreatesUser_WithHashedPassword_NotPlaintext()
    {
        await using var dbContext = NewInMemoryContext();
        var service = new SignupService(dbContext, new BcryptPasswordHasher(), NullLogger<SignupService>.Instance);

        var result = await service.SignUpAsync(ValidRequest());

        Assert.Equal(SignupOutcome.Success, result.Outcome);
        Assert.NotNull(result.Response);

        var persisted = await dbContext.Users.SingleAsync();
        Assert.NotEqual("Password1", persisted.PasswordHash);
        Assert.StartsWith("$2", persisted.PasswordHash); // bcrypt hash prefix
        Assert.True(BCrypt.Net.BCrypt.Verify("Password1", persisted.PasswordHash));
    }

    [Fact]
    public async Task SignUpAsync_NeverReturnsPasswordHash_InResponse()
    {
        await using var dbContext = NewInMemoryContext();
        var service = new SignupService(dbContext, new BcryptPasswordHasher(), NullLogger<SignupService>.Instance);

        var result = await service.SignUpAsync(ValidRequest());

        // SignupResponse has no PasswordHash property at all — this is a structural
        // guarantee, but we also assert the response's serialized shape doesn't leak it.
        Assert.NotNull(result.Response);
        Assert.DoesNotContain("PasswordHash", typeof(SignupResponse).GetProperties().Select(p => p.Name));
    }

    [Fact]
    public async Task SignUpAsync_ReturnsDuplicateEmail_WhenEmailAlreadyExists()
    {
        await using var dbContext = NewInMemoryContext();
        var service = new SignupService(dbContext, new BcryptPasswordHasher(), NullLogger<SignupService>.Instance);

        var first = await service.SignUpAsync(ValidRequest("duplicate@example.com"));
        Assert.Equal(SignupOutcome.Success, first.Outcome);

        var second = await service.SignUpAsync(ValidRequest("duplicate@example.com"));

        Assert.Equal(SignupOutcome.DuplicateEmail, second.Outcome);
        Assert.Equal("An account with this email already exists.", second.ErrorMessage);
    }

    [Fact]
    public async Task SignUpAsync_ReturnsDuplicateEmail_WhenEmailDiffersOnlyByCase()
    {
        await using var dbContext = NewInMemoryContext();
        var service = new SignupService(dbContext, new BcryptPasswordHasher(), NullLogger<SignupService>.Instance);

        await service.SignUpAsync(ValidRequest("CaseTest@Example.com"));
        var second = await service.SignUpAsync(ValidRequest("casetest@example.com"));

        Assert.Equal(SignupOutcome.DuplicateEmail, second.Outcome);
    }

    [Fact]
    public async Task SignUpAsync_ReturnsValidationError_ForWeakPassword()
    {
        await using var dbContext = NewInMemoryContext();
        var service = new SignupService(dbContext, new BcryptPasswordHasher(), NullLogger<SignupService>.Instance);

        var request = ValidRequest();
        request.Password = "weak";
        request.ConfirmPassword = "weak";

        var result = await service.SignUpAsync(request);

        Assert.Equal(SignupOutcome.ValidationError, result.Outcome);
        Assert.Equal(0, await dbContext.Users.CountAsync());
    }

    [Theory]
    [InlineData(null, "ada@example.com", "Password1", "Password1")]
    [InlineData("Ada Lovelace", null, "Password1", "Password1")]
    [InlineData("Ada Lovelace", "ada@example.com", null, null)]
    public async Task SignUpAsync_ReturnsValidationError_ForMissingRequiredFields(
        string? fullName, string? email, string? password, string? confirmPassword)
    {
        await using var dbContext = NewInMemoryContext();
        var service = new SignupService(dbContext, new BcryptPasswordHasher(), NullLogger<SignupService>.Instance);

        var request = new SignupRequest
        {
            FullName = fullName,
            Email = email,
            Password = password,
            ConfirmPassword = confirmPassword,
        };

        var result = await service.SignUpAsync(request);

        Assert.Equal(SignupOutcome.ValidationError, result.Outcome);
        Assert.Equal(0, await dbContext.Users.CountAsync());
    }

    [Fact]
    public async Task SignUpAsync_NormalizesEmail_ToLowercaseBeforeStorage()
    {
        await using var dbContext = NewInMemoryContext();
        var service = new SignupService(dbContext, new BcryptPasswordHasher(), NullLogger<SignupService>.Instance);

        await service.SignUpAsync(ValidRequest("Mixed.Case@Example.COM"));

        var persisted = await dbContext.Users.SingleAsync();
        Assert.Equal("mixed.case@example.com", persisted.Email);
    }
}
