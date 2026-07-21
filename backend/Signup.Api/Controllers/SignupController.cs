using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Signup.Api.Models;
using Signup.Api.Services;

namespace Signup.Api.Controllers;

[ApiController]
[Route("api/signup")]
public class SignupController : ControllerBase
{
    private readonly ISignupService _signupService;
    private readonly ILogger<SignupController> _logger;

    public SignupController(ISignupService signupService, ILogger<SignupController> logger)
    {
        _signupService = signupService;
        _logger = logger;
    }

    /// <summary>
    /// POST /api/signup — creates a new user account.
    /// 201 on success, 400 on validation failure, 409 on duplicate email, 500 otherwise.
    /// Rate-limited via the "signup" fixed-window policy (see Program.cs) — AC #16.
    /// </summary>
    [HttpPost]
    [EnableRateLimiting("signup")]
    [ProducesResponseType(typeof(SignupResponse), StatusCodes.Status201Created)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status400BadRequest)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status409Conflict)]
    [ProducesResponseType(typeof(ErrorResponse), StatusCodes.Status500InternalServerError)]
    public async Task<IActionResult> Post([FromBody] SignupRequest? request, CancellationToken cancellationToken)
    {
        try
        {
            request ??= new SignupRequest();

            var result = await _signupService.SignUpAsync(request, cancellationToken);

            return result.Outcome switch
            {
                SignupOutcome.Success => StatusCode(StatusCodes.Status201Created, result.Response),
                SignupOutcome.ValidationError => BadRequest(new ErrorResponse(result.ErrorMessage!)),
                SignupOutcome.DuplicateEmail => Conflict(new ErrorResponse(result.ErrorMessage!)),
                _ => StatusCode(StatusCodes.Status500InternalServerError,
                    new ErrorResponse("Something went wrong. Please try again.")),
            };
        }
        catch (Exception ex)
        {
            // Never log request.Password or request.ConfirmPassword here — only
            // non-sensitive diagnostic context.
            _logger.LogError(ex, "Unhandled error while processing a signup request");
            return StatusCode(StatusCodes.Status500InternalServerError,
                new ErrorResponse("Something went wrong. Please try again."));
        }
    }
}
