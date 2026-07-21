namespace Signup.Api.Services;

/// <summary>
/// bcrypt-based password hasher (AC #12). Work factor 12 is a reasonable default as of
/// 2026 hardware; revisit periodically as a config value if this needs to be tuned per
/// environment.
/// </summary>
public class BcryptPasswordHasher : IPasswordHasher
{
    private const int WorkFactor = 12;

    public string Hash(string plainTextPassword)
    {
        return BCrypt.Net.BCrypt.HashPassword(plainTextPassword, workFactor: WorkFactor);
    }

    public bool Verify(string plainTextPassword, string hash)
    {
        return BCrypt.Net.BCrypt.Verify(plainTextPassword, hash);
    }
}
