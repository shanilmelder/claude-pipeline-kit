using Signup.Api.Models;

namespace Signup.Api.Services;

public interface ISignupService
{
    Task<SignupResult> SignUpAsync(SignupRequest request, CancellationToken cancellationToken = default);
}
