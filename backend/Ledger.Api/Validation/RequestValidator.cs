using System.ComponentModel.DataAnnotations;

namespace Ledger.Api.Validation;

/// <summary>
/// Runs DataAnnotations validation for minimal API request bodies and shapes
/// the failures into the dictionary that <c>Results.ValidationProblem</c>
/// renders as an RFC 7807 ValidationProblemDetails.
/// </summary>
public static class RequestValidator
{
    public static bool TryValidate(object model, out Dictionary<string, string[]> errors)
    {
        var results = new List<ValidationResult>();
        var isValid = Validator.TryValidateObject(
            model,
            new ValidationContext(model),
            results,
            validateAllProperties: true);

        errors = results
            .SelectMany(r => r.MemberNames.DefaultIfEmpty(string.Empty),
                (r, member) => new { Member = member, Message = r.ErrorMessage ?? "Invalid value." })
            .GroupBy(x => x.Member)
            .ToDictionary(g => g.Key, g => g.Select(x => x.Message).ToArray());

        return isValid;
    }
}
