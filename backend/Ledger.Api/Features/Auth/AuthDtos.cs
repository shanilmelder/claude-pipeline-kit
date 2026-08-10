using System.ComponentModel.DataAnnotations;

namespace Ledger.Api.Features.Auth;

public class RegisterRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    [MaxLength(128)]
    public string Password { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required]
    [EmailAddress]
    [MaxLength(256)]
    public string Email { get; set; } = string.Empty;

    [Required]
    [MinLength(8)]
    [MaxLength(128)]
    public string Password { get; set; } = string.Empty;
}

/// <summary>The user projection returned by register, login and <c>/auth/me</c>.</summary>
public record UserResponse(string Id, string Email);

/// <summary>Returned by both register (201) and login (200).</summary>
public record AuthResponse(string Token, UserResponse User);
