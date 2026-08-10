namespace Ledger.Api.Domain;

/// <summary>
/// Canonical category type values. Persisted as the lowercase strings
/// "income" / "expense" and exposed over the API in exactly that form.
/// </summary>
public static class CategoryType
{
    public const string Income = "income";
    public const string Expense = "expense";
}
