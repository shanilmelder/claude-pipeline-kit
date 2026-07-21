namespace Signup.Api.Models;

/// <summary>
/// Consistent error envelope for all non-2xx signup responses: { "error": "message" }.
/// (AC #15). "Field" is intentionally omitted from the contract (documented "your call"
/// item in the research brief) to keep the shape identical across 400/409/500 — the
/// message text itself indicates which rule failed.
/// </summary>
public class ErrorResponse
{
    public ErrorResponse()
    {
    }

    public ErrorResponse(string error)
    {
        Error = error;
    }

    public string Error { get; set; } = string.Empty;
}
