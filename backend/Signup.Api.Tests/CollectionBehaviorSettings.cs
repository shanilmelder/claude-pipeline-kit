using Xunit;

// SignupApiFactory and RateLimitingTests's TightlyRateLimitedFactory both mutate
// process-wide RateLimiting__* environment variables to control the signup endpoint's
// rate limit for their own tests (see comments on both classes). Disabling collection
// parallelization keeps those overrides from racing across test classes.
[assembly: CollectionBehavior(DisableTestParallelization = true)]
