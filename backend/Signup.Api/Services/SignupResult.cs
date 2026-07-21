using Signup.Api.Models;

namespace Signup.Api.Services;

public enum SignupOutcome
{
    Success,
    ValidationError,
    DuplicateEmail,
}

public class SignupResult
{
    public required SignupOutcome Outcome { get; init; }

    public string? ErrorMessage { get; init; }

    public SignupResponse? Response { get; init; }

    public static SignupResult Success(SignupResponse response) => new()
    {
        Outcome = SignupOutcome.Success,
        Response = response,
    };

    public static SignupResult ValidationFailed(string message) => new()
    {
        Outcome = SignupOutcome.ValidationError,
        ErrorMessage = message,
    };

    public static SignupResult DuplicateEmailError(string message) => new()
    {
        Outcome = SignupOutcome.DuplicateEmail,
        ErrorMessage = message,
    };
}
