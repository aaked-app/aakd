# Aakd analytics and privacy information

This page explains Aakd's public-website analytics. It is not a
deployment-specific privacy policy. Organizations that self-host Aakd are
responsible for their own deployment, privacy notice, legal basis, retention,
and processor choices.

## Public website analytics

The public Aakd landing page asks before enabling product analytics. If you
accept, the website enables a pseudonymous homepage page-view event and a
small set of aggregate CTA events: opening the self-hosting guide, opening a
GitHub resource, and starting registration. Those events contain a fixed
homepage path, a fixed CTA name, a fixed destination class, and one fixed
`source_class`: `google_organic`, `bing_organic`, `known_ai_referral`,
`other_referral`, or `direct_or_unknown`. The class is derived locally from an
exact reviewed hostname. Google covers `google.com`, `www.google.com`,
`google.co.uk`, and `www.google.co.uk`; Bing covers `bing.com` and
`www.bing.com`; known AI referrals cover exactly `chatgpt.com`,
`perplexity.ai`, `claude.ai`, `copilot.microsoft.com`, and `gemini.google.com`.
Other subdomains stay `other_referral`. The PostHog client also
supplies pseudonymous `distinct_id` and `$device_id` values, a
pseudonymous event UUID and `$insert_id`, its library name and version, and
event time.
It does not send the landing-page query string, UTM or campaign values,
referrer, contract content, or customer identifiers. If you decline, or have
not made a choice, client analytics remain disabled. Browser analytics are
disabled on authentication and application routes, even if the public-site
choice was previously accepted.

High-intent CTA events use a privacy-minimal in-memory dedupe. Only the first
high-intent action in one loaded browser runtime is emitted; every later CTA
action in that runtime is ignored, regardless of event type or destination. A
full page reload or a new tab starts a new runtime and resets the flag;
client-side navigation and consent changes do not. KPI reporting therefore
treats a high-intent action as one emitted event per loaded runtime, not as a
unique person or customer. Reloads and new tabs can overcount this unit.
The SEO/GEO scorecard attributes high-intent actions only when `source_class`
is `google_organic`, `bing_organic`, or `known_ai_referral`; the other two
classes are diagnostic and are not counted as search/AI-attributed actions.

The consent choice is stored in the browser as `cookie_consent` with the value
`accepted` or `declined`. You can clear that browser storage to be asked again.

## What this does not collect

Do not enter contract content, credentials, secrets, or other confidential
information into public feedback channels. Aakd's public-site analytics must
not be used to send contract text, document names, user-entered content,
credentials, URL query values, or other secrets.

## Application and server telemetry

This public-site consent mechanism does not authorize analytics for the
authenticated application. Aakd's browser client therefore does not identify
authenticated users or capture application page views through this public-site
analytics setup. Server-side operational telemetry, if an operator configures
it, is a separate deployment concern and must be documented by that operator.

## Self-hosted application data

Aakd is self-hostable. The operator of an Aakd deployment chooses its hosting,
storage, AI provider configuration, email provider, and operational controls.
Review the [self-hosting guide](self-hosting.md) and the repository's
[security policy](../SECURITY.md) before deploying with real contracts.

## Contact and security reports

For a security vulnerability, follow the private process in
[SECURITY.md](../SECURITY.md). Do not publish confidential contract data in an
issue, discussion, or public channel.
