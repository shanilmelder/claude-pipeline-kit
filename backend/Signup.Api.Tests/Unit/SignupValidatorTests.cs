using Signup.Api.Models;
using Signup.Api.Services;

namespace Signup.Api.Tests.Unit;

public class SignupValidatorTests
{
    private static SignupRequest ValidRequest() => new()
    {
        FullName = "Ada Lovelace",
        Email = "ada@example.com",
        Password = "Password1",
        ConfirmPassword = "Password1",
    };

    [Fact]
    public void Validate_ReturnsNull_ForFullyValidRequest()
    {
        var result = SignupValidator.Validate(ValidRequest());

        Assert.Null(result);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    [InlineData("   ")]
    public void Validate_Fails_WhenFullNameMissing(string? fullName)
    {
        var request = ValidRequest();
        request.FullName = fullName;

        var result = SignupValidator.Validate(request);

        Assert.NotNull(result);
        Assert.Contains("Full name", result);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Validate_Fails_WhenEmailMissing(string? email)
    {
        var request = ValidRequest();
        request.Email = email;

        var result = SignupValidator.Validate(request);

        Assert.NotNull(result);
        Assert.Contains("Email", result);
    }

    [Theory]
    [InlineData("not-an-email")]
    [InlineData("missing-at-sign.com")]
    [InlineData("double@@example.com")]
    public void Validate_Fails_WhenEmailFormatInvalid(string email)
    {
        var request = ValidRequest();
        request.Email = email;

        var result = SignupValidator.Validate(request);

        Assert.NotNull(result);
        Assert.Contains("format", result, StringComparison.OrdinalIgnoreCase);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public void Validate_Fails_WhenPasswordMissing(string? password)
    {
        var request = ValidRequest();
        request.Password = password;
        request.ConfirmPassword = password;

        var result = SignupValidator.Validate(request);

        Assert.NotNull(result);
        Assert.Contains("Password", result);
    }

    [Theory]
    [InlineData("short1")] // too short, but has a digit
    [InlineData("abc12")]
    public void Validate_Fails_WhenPasswordShorterThanEightCharacters(string password)
    {
        var request = ValidRequest();
        request.Password = password;
        request.ConfirmPassword = password;

        var result = SignupValidator.Validate(request);

        Assert.NotNull(result);
        Assert.Contains("8 characters", result);
    }

    [Theory]
    [InlineData("nodigitshere")]
    [InlineData("alllettersandnothingelse")]
    public void Validate_Fails_WhenPasswordHasNoDigit(string password)
    {
        var request = ValidRequest();
        request.Password = password;
        request.ConfirmPassword = password;

        var result = SignupValidator.Validate(request);

        Assert.NotNull(result);
        Assert.Contains("digit", result);
    }

    [Fact]
    public void Validate_Fails_WhenConfirmPasswordDoesNotMatchPassword()
    {
        var request = ValidRequest();
        request.ConfirmPassword = "Password2";

        var result = SignupValidator.Validate(request);

        Assert.NotNull(result);
        Assert.Contains("match", result, StringComparison.OrdinalIgnoreCase);
    }

    [Fact]
    public void Validate_Fails_WhenConfirmPasswordMissing()
    {
        var request = ValidRequest();
        request.ConfirmPassword = null;

        var result = SignupValidator.Validate(request);

        Assert.NotNull(result);
    }
}
