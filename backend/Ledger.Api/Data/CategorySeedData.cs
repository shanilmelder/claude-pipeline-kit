using Ledger.Api.Domain;

namespace Ledger.Api.Data;

/// <summary>
/// The full, fixed set of categories. These ids are authoritative for every
/// later story that references a category, so they must never be renumbered.
/// Seeded through <c>HasData</c> so they land in the migration and are
/// idempotent from an empty database.
/// </summary>
public static class CategorySeedData
{
    public static readonly Category[] All =
    [
        new() { Id = 1, Name = "Food & Groceries", Type = CategoryType.Expense },
        new() { Id = 2, Name = "Transport", Type = CategoryType.Expense },
        new() { Id = 3, Name = "Housing & Utilities", Type = CategoryType.Expense },
        new() { Id = 4, Name = "Health", Type = CategoryType.Expense },
        new() { Id = 5, Name = "Education", Type = CategoryType.Expense },
        new() { Id = 6, Name = "Entertainment", Type = CategoryType.Expense },
        new() { Id = 7, Name = "Shopping", Type = CategoryType.Expense },
        new() { Id = 8, Name = "Other", Type = CategoryType.Expense },
        new() { Id = 9, Name = "Salary", Type = CategoryType.Income },
        new() { Id = 10, Name = "Freelance", Type = CategoryType.Income },
        new() { Id = 11, Name = "Other Income", Type = CategoryType.Income },
    ];
}
