namespace Ledger.Api.Services;

/// <summary>
/// Bound from the <c>Jwt</c> configuration section. In production the key is
/// supplied via environment variable or user-secrets, never from a committed file.
/// </summary>
public class JwtOptions
{
    public const string SectionName = "Jwt";

    public string Key { get; set; } = string.Empty;

    public string Issuer { get; set; } = "ledger-api";

    public string Audience { get; set; } = "ledger-web";

    public int ExpiryMinutes { get; set; } = 60;
}
