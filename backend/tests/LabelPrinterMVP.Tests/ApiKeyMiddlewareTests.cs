using System.Text.Json;
using LabelPrinterMVP.Middleware;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Configuration;

namespace LabelPrinterMVP.Tests;

public class ApiKeyMiddlewareTests
{
    private const string ValidApiKey = "test-secret-api-key-12345";

    private IConfiguration CreateConfiguration(string? apiKey = ValidApiKey)
    {
        var inMemorySettings = new Dictionary<string, string?>();
        if (apiKey != null)
        {
            inMemorySettings["Authentication:ApiKey"] = apiKey;
        }

        return new ConfigurationBuilder()
            .AddInMemoryCollection(inMemorySettings)
            .Build();
    }

    private DefaultHttpContext CreateHttpContext(string path = "/api/print/tcp", string method = "POST")
    {
        var context = new DefaultHttpContext();
        context.Request.Path = path;
        context.Request.Method = method;
        context.Response.Body = new MemoryStream();
        return context;
    }

    [Fact]
    public async Task InvokeAsync_WhenOptionsMethod_ShouldBypassAuthenticationAndCallNext()
    {
        // Arrange: Preflight CORS OPTIONS
        var context = CreateHttpContext("/api/print/tcp", "OPTIONS");
        var config = CreateConfiguration();
        var nextCalled = false;
        var middleware = new ApiKeyMiddleware((innerContext) =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context, config);

        // Assert
        Assert.True(nextCalled);
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }

    [Theory]
    [InlineData("/api/health")]
    [InlineData("/api/health/")]
    [InlineData("/API/HEALTH")]
    public async Task InvokeAsync_WhenHealthEndpoint_ShouldBypassAuthenticationAndCallNext(string healthPath)
    {
        // Arrange
        var context = CreateHttpContext(healthPath, "GET");
        var config = CreateConfiguration();
        var nextCalled = false;
        var middleware = new ApiKeyMiddleware((innerContext) =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context, config);

        // Assert
        Assert.True(nextCalled);
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_WhenNoApiKeyConfigured_ShouldAllowAccessInDevelopment()
    {
        // Arrange: Sin clave en configuración (modo abierto)
        var context = CreateHttpContext("/api/print/tcp", "POST");
        var config = CreateConfiguration(apiKey: null);
        var nextCalled = false;
        var middleware = new ApiKeyMiddleware((innerContext) =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context, config);

        // Assert
        Assert.True(nextCalled);
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }

    [Fact]
    public async Task InvokeAsync_WhenApiKeyHeaderMissing_ShouldReturn401Unauthorized()
    {
        // Arrange: Petición sin el header X-Api-Key
        var context = CreateHttpContext("/api/print/tcp", "POST");
        var config = CreateConfiguration();
        var nextCalled = false;
        var middleware = new ApiKeyMiddleware((innerContext) =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context, config);

        // Assert
        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status401Unauthorized, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var responseBody = await reader.ReadToEndAsync();
        using var jsonDoc = JsonDocument.Parse(responseBody);
        var root = jsonDoc.RootElement;

        Assert.False(root.GetProperty("success").GetBoolean());
        Assert.Contains("X-Api-Key", root.GetProperty("error").GetString());
    }

    [Fact]
    public async Task InvokeAsync_WhenApiKeyHeaderInvalid_ShouldReturn403Forbidden()
    {
        // Arrange: Petición con header incorrecto
        var context = CreateHttpContext("/api/print/tcp", "POST");
        context.Request.Headers["X-Api-Key"] = "clave-incorrecta-999";
        var config = CreateConfiguration();
        var nextCalled = false;
        var middleware = new ApiKeyMiddleware((innerContext) =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context, config);

        // Assert
        Assert.False(nextCalled);
        Assert.Equal(StatusCodes.Status403Forbidden, context.Response.StatusCode);

        context.Response.Body.Seek(0, SeekOrigin.Begin);
        using var reader = new StreamReader(context.Response.Body);
        var responseBody = await reader.ReadToEndAsync();
        using var jsonDoc = JsonDocument.Parse(responseBody);
        var root = jsonDoc.RootElement;

        Assert.False(root.GetProperty("success").GetBoolean());
        Assert.Contains("inválida", root.GetProperty("error").GetString());
    }

    [Fact]
    public async Task InvokeAsync_WhenApiKeyHeaderValid_ShouldCallNextDelegate()
    {
        // Arrange: Petición con header correcto
        var context = CreateHttpContext("/api/print/tcp", "POST");
        context.Request.Headers["X-Api-Key"] = ValidApiKey;
        var config = CreateConfiguration();
        var nextCalled = false;
        var middleware = new ApiKeyMiddleware((innerContext) =>
        {
            nextCalled = true;
            return Task.CompletedTask;
        });

        // Act
        await middleware.InvokeAsync(context, config);

        // Assert
        Assert.True(nextCalled);
        Assert.Equal(StatusCodes.Status200OK, context.Response.StatusCode);
    }
}
