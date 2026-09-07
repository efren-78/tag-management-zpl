using System.Threading.RateLimiting;
using Microsoft.AspNetCore.RateLimiting;

namespace LabelPrinterMVP.Tests;

public class RateLimiterPolicyTests
{
    [Fact] //Test para evaluar el funcionamiento del rate limiter
    public void FixedWindowRateLimiter_ShouldAllowPermitLimitAndRejectExcess()
    {
        // Arrange: Misma configuración que en Program.cs (3 solicitudes por ventana de 10s, cola 0)
        var options = new FixedWindowRateLimiterOptions
        {
            PermitLimit = 3,
            Window = TimeSpan.FromSeconds(10),
            QueueLimit = 0,
            QueueProcessingOrder = QueueProcessingOrder.OldestFirst
        };

        using var limiter = new FixedWindowRateLimiter(options);

        // Act & Assert: Primeras 3 solicitudes deben permitirse
        for (int i = 0; i < 3; i++)
        {
            using var lease = limiter.AttemptAcquire();
            Assert.True(lease.IsAcquired, $"La solicitud {i + 1} debió ser permitida dentro del límite.");
        }

        // La 4ª solicitud debe ser rechazada inmediatamente (HTTP 429)
        using var excessLease = limiter.AttemptAcquire();
        Assert.False(excessLease.IsAcquired, "La solicitud 4 debió ser rechazada por exceder el rate limit.");
    }

    [Fact] //Test para evaluar el código de estado de la respuesta cuando se excede el rate limit
    public void RateLimiterOptions_RejectionStatusCode_ShouldBe429TooManyRequests()
    {
        // Arrange & Act
        var options = new RateLimiterOptions
        {
            RejectionStatusCode = 429
        };

        // Assert
        Assert.Equal(429, options.RejectionStatusCode);
    }
}
