# Security policy

## Reporting a vulnerability

Use [GitHub's private security advisory](https://github.com/supaku/kinring/security/advisories/new) to report any security concern. We'll triage within 5 business days.

Please do not file public issues for security-sensitive problems.

## Scope

kinring serves redirects and a small script on behalf of a list of member
sites. Issues we'd like to know about:

- Open redirects: any way to make `/prev`, `/next`, or `/random` send a
  visitor somewhere that is not a validated member URL.
- Injection through member data into `ring.json`, `members.opml`, or the
  generated embed snippet.
- Anything in `embed.js` that lets a ring host run code on a member's page
  beyond rendering the banner.
