# QuantumPad open source

Public source repository: https://github.com/quantumpad-labs/quantumpad-labs

Production website: https://quantumpad.online

This initial source release is based on production-source commit
`2f56a9d0cb85f1a72bb30a3347893b882ba67e25`. It contains the application,
contracts, database migration, tests and setup documentation. It does not
include production credentials, database contents, wallet keys, local media
exports or deployment account configuration.

## License

Original QuantumPad source is available under the MIT license in `LICENSE`.
Third-party code, packages, fonts, icons and imagery remain subject to their
own licenses and attribution requirements; the project license does not
relicense them. Preserve the notices distributed with those assets and
dependencies. Brand names and logos identify their respective owners and do
not imply endorsement or grant trademark rights.

## Deployment separation

Publishing this repository does not move or recreate the existing Vercel
project, production domains, environment variables or database. Production
continues using its existing Git connection. Changes proposed here do not
automatically deploy to the hosted QuantumPad service.

For your own deployment, create a separate hosting project and configure your
own secrets using `.env.example`. Never commit `.env.local`, provider keys or
wallet credentials. See `README.md` for configuration and operational limits.

## Contributions

Open an issue to describe a bug or proposed change. Submit a focused pull
request with relevant tests. Run `pnpm test`, `pnpm typecheck` and `pnpm build`
before requesting review. Do not include credentials or user data in reports.
