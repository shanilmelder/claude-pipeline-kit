using Ledger.Api.Data;
using Microsoft.EntityFrameworkCore;

namespace Ledger.Api.Features.Categories;

/// <summary>The category list projection returned to clients.</summary>
public record CategoryResponse(int Id, string Name, string Type);

public static class CategoryEndpoints
{
    public static IEndpointRouteBuilder MapCategoryEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/api/categories").WithTags("Categories");

        // Read-only by design: categories are a fixed seeded set, so there is
        // deliberately no POST/PUT/PATCH/DELETE on this resource.
        group.MapGet("", ListAsync);

        return app;
    }

    private static async Task<IResult> ListAsync(LedgerDbContext db, CancellationToken cancellationToken)
    {
        var categories = await db.Categories
            .AsNoTracking()
            .OrderBy(c => c.Type)
            .ThenBy(c => c.Id)
            .Select(c => new CategoryResponse(c.Id, c.Name, c.Type))
            .ToListAsync(cancellationToken);

        return Results.Ok(categories);
    }
}
