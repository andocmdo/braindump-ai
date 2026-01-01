"""
Braindump LLM Integration

Handles LLM calls for document consolidation.
Supports multiple providers: OpenRouter (default), Anthropic (future).
"""

import os
import json
import httpx
from typing import Optional
from abc import ABC, abstractmethod


class LLMProvider(ABC):
    """Base class for LLM providers."""

    def __init__(self, model: str, api_key: str):
        self.model = model
        self.api_key = api_key

    @abstractmethod
    def complete(self, prompt: str, system: Optional[str] = None, max_tokens: int = 4096) -> str:
        """Generate a completion for the given prompt."""
        pass


class OpenRouterProvider(LLMProvider):
    """OpenRouter API provider (OpenAI-compatible API)."""

    BASE_URL = "https://openrouter.ai/api/v1/chat/completions"

    def __init__(self, model: str, api_key: str, site_url: str = "", site_name: str = "Braindump"):
        super().__init__(model, api_key)
        self.site_url = site_url
        self.site_name = site_name

    def complete(self, prompt: str, system: Optional[str] = None, max_tokens: int = 4096) -> str:
        """Generate a completion using OpenRouter API."""
        messages = []

        if system:
            messages.append({"role": "system", "content": system})

        messages.append({"role": "user", "content": prompt})

        headers = {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "HTTP-Referer": self.site_url,
            "X-Title": self.site_name,
        }

        payload = {
            "model": self.model,
            "messages": messages,
            "max_tokens": max_tokens,
        }

        try:
            with httpx.Client(timeout=120.0) as client:
                response = client.post(self.BASE_URL, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()

                # Extract the response content
                if "choices" in data and len(data["choices"]) > 0:
                    return data["choices"][0]["message"]["content"]
                else:
                    raise ValueError(f"Unexpected response format: {data}")

        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"OpenRouter API error: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            raise RuntimeError(f"OpenRouter request failed: {str(e)}")


class AnthropicProvider(LLMProvider):
    """Anthropic Claude API provider."""

    BASE_URL = "https://api.anthropic.com/v1/messages"

    def __init__(self, model: str, api_key: str):
        super().__init__(model, api_key)

    def complete(self, prompt: str, system: Optional[str] = None, max_tokens: int = 4096) -> str:
        """Generate a completion using Anthropic API."""
        headers = {
            "x-api-key": self.api_key,
            "Content-Type": "application/json",
            "anthropic-version": "2023-06-01",
        }

        payload = {
            "model": self.model,
            "max_tokens": max_tokens,
            "messages": [{"role": "user", "content": prompt}],
        }

        if system:
            payload["system"] = system

        try:
            with httpx.Client(timeout=120.0) as client:
                response = client.post(self.BASE_URL, headers=headers, json=payload)
                response.raise_for_status()
                data = response.json()

                # Extract the response content
                if "content" in data and len(data["content"]) > 0:
                    return data["content"][0]["text"]
                else:
                    raise ValueError(f"Unexpected response format: {data}")

        except httpx.HTTPStatusError as e:
            raise RuntimeError(f"Anthropic API error: {e.response.status_code} - {e.response.text}")
        except httpx.RequestError as e:
            raise RuntimeError(f"Anthropic request failed: {str(e)}")


def resolve_env_var(value: str) -> str:
    """Resolve environment variable references like ${VAR_NAME}."""
    if isinstance(value, str) and value.startswith("${") and value.endswith("}"):
        env_var = value[2:-1]
        resolved = os.environ.get(env_var, "")
        if not resolved:
            print(f"Warning: Environment variable {env_var} not set")
        return resolved
    return value


class LLMManager:
    """Manages LLM provider initialization and API calls."""

    def __init__(self, config: dict):
        self.config = config
        self.provider: Optional[LLMProvider] = None
        self._init_provider()

    def _init_provider(self):
        provider_type = self.config.get("provider", "openrouter")
        model = self.config.get("model", "anthropic/claude-3.5-sonnet")
        api_key = resolve_env_var(self.config.get("api_key", ""))

        if not api_key:
            raise ValueError(f"No API key configured for LLM provider: {provider_type}")

        if provider_type == "openrouter":
            site_url = self.config.get("site_url", "")
            site_name = self.config.get("site_name", "Braindump")
            self.provider = OpenRouterProvider(model, api_key, site_url, site_name)
            print(f"LLM provider initialized: OpenRouter ({model})")

        elif provider_type == "anthropic":
            self.provider = AnthropicProvider(model, api_key)
            print(f"LLM provider initialized: Anthropic ({model})")

        else:
            raise ValueError(f"Unknown LLM provider: {provider_type}")

    def complete(self, prompt: str, system: Optional[str] = None, max_tokens: int = 4096) -> str:
        """Generate a completion."""
        if not self.provider:
            raise RuntimeError("No LLM provider configured")
        return self.provider.complete(prompt, system, max_tokens)

    @property
    def model(self) -> str:
        """Get the current model name."""
        return self.provider.model if self.provider else ""

    @property
    def is_initialized(self) -> bool:
        """Check if provider is initialized."""
        return self.provider is not None
