namespace Signup.Api.Models;

/// <summary>
/// 201 Created response body for POST /api/signup. Deliberately excludes PasswordHash
/// (AC #19: sensitive fields are never returned in API responses).
/// </summary>
public class SignupResponse
{
    public Guid Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    public string Email { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
