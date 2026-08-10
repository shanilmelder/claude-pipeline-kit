namespace Ledger.Api.Domain;

/// <summary>
/// A fixed, seed-only spending/earning category. Ids are explicit constants
/// (not identity-generated) because later stories foreign-key to them.
/// There is intentionally no API to create, rename or delete a category.
/// </summary>
public class Category
{
    public int Id { get; set; }

    public string Name { get; set; } = string.Empty;

    /// <summary>Either <see cref="CategoryType.Income"/> or <see cref="CategoryType.Expense"/>.</summary>
    public string Type { get; set; } = CategoryType.Expense;
}
