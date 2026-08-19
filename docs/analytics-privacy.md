# Aakd analytics and privacy information

This page explains Aakd's public-website analytics. It is not a
deployment-specific privacy policy. Organizations that self-host Aakd are
responsible for their own deployment, privacy notice, legal basis, retention,
and processor choices.

## Public website analytics

The public Aakd landing page asks before enabling product analytics. If you
accept, the website enables a pseudonymous homepage page-view event and a
small set of aggregate CTA events: opening the self-hosting guide, opening the
GitHub repository, and starting registration. Those events contain only the
homepage path, a fixed CTA name/destination class, a referrer domain, and a
valid UTM campaign value when present. If you decline, or have not made a
choice, client analytics remain disabled. Browser analytics are disabled on
authentication and application routes, even if the public-site choice was
previously accepted.

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
