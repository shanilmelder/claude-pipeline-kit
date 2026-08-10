namespace Ledger.Api.Domain;

/// <summary>
/// A registered Ledger user. Credentials are stored as a bcrypt hash; plaintext
/// passwords are never persisted.
/// </summary>
public class User
{
    public Guid Id { get; set; }

    /// <summary>Always stored trimmed and lowercased so lookups are case-insensitive.</summary>
    public string Email { get; set; } = string.Empty;

    public string PasswordHash { get; set; } = string.Empty;

    public DateTime CreatedAt { get; set; }
}
