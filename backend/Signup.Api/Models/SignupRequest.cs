namespace Signup.Api.Models;

/// <summary>
/// Request body for POST /api/signup.
///
/// NOTE (deviation, documented per research brief): the server DOES re-validate that
/// ConfirmPassword matches Password, in addition to whatever the UI does. Ticket AC #13
/// says server-side validation must mirror UI validation and never trust client-only
/// checks, so confirmPassword equality is treated as a real server-side rule, not just
/// a UI nicety.
/// </summary>
public class SignupRequest
{
    public string? FullName { get; set; }

    public string? Email { get; set; }

    public string? Password { get; set; }

    public string? ConfirmPassword { get; set; }
}
