namespace Signup.Api.Models;

/// <summary>
/// Database entity for the "users" table. PasswordHash is never surfaced via the API.
/// </summary>
public class User
{
    public Guid Id { get; set; }

    public string FullName { get; set; } = string.Empty;

    /// <summary>
    /// Stored lowercase/trimmed for case-insensitive uniqueness. See AppDbContext for the
    /// database-level unique constraint.
    /// </summary>
    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public DateTimeOffset CreatedAt { get; set; }
}
