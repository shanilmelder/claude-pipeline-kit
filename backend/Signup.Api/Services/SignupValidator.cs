using System.Net.Mail;
using System.Text.RegularExpressions;
using Signup.Api.Models;

namespace Signup.Api.Services;

/// <summary>
/// Server-side validation mirroring the UI's rules (AC #13). Never trust client-only
/// validation — this runs regardless of what the frontend already checked.
/// </summary>
public static class SignupValidator
{
    private static readonly Regex DigitRegex = new(@"\d", RegexOptions.Compiled);

    /// <summary>
    /// Returns null if valid, otherwise a human-readable error message describing the
    /// first validation failure found.
    /// </summary>
    public static string? Validate(SignupRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.FullName))
        {
            return "Full name is required.";
        }

        if (string.IsNullOrWhiteSpace(request.Email))
        {
            return "Email is required.";
        }

        if (!IsValidEmail(request.Email))
        {
            return "Email format is invalid.";
        }

        if (string.IsNullOrWhiteSpace(request.Password))
        {
            return "Password is required.";
        }

        if (request.Password.Length < 8)
        {
            return "Password must be at least 8 characters long.";
        }

        if (!DigitRegex.IsMatch(request.Password))
        {
            return "Password must contain at least one digit.";
        }

        if (string.IsNullOrWhiteSpace(request.ConfirmPassword))
        {
            return "Confirm password is required.";
        }

        if (!string.Equals(request.Password, request.ConfirmPassword, StringComparison.Ordinal))
        {
            return "Password and confirm password do not match.";
        }

        return null;
    }

    private static bool IsValidEmail(string email)
    {
        try
        {
            var address = new MailAddress(email);
            return address.Address == email.Trim();
        }
        catch (FormatException)
        {
            return false;
        }
    }
}
