#!/usr/bin/env bash
set -euo pipefail
umask 077
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$project_dir"
[[ -f .local/deploy-config.json ]] || { echo 'Configure .local/deploy-config.json first.' >&2; exit 1; }
python3 -m venv .local/publisher-venv
.local/publisher-venv/bin/pip install --disable-pip-version-check -r scripts/publisher-requirements.txt
bash scripts/node.sh node --input-type=module -e 'import {config} from "dotenv"; import fs from "node:fs"; config({quiet:true}); if(!process.env.DATABASE_URL)throw Error("DATABASE_URL required"); fs.writeFileSync(".local/publisher-config.json",JSON.stringify({databaseUrl:process.env.DATABASE_URL})+"\n",{mode:0o600});'
python3 - <<'PY'
from pathlib import Path
root=Path.cwd()
escaped=str(root).replace('\\','\\\\').replace('"','\\"').replace('%','%%')
unit=(root/'ops/pbengblog-publisher.service').read_text().replace('@PROJECT_DIR@',escaped)
p=Path.home()/'.config/systemd/user/pbengblog-publisher.service'
p.parent.mkdir(parents=True,exist_ok=True);p.write_text(unit)
PY
systemctl --user daemon-reload
systemctl --user enable --now pbengblog-publisher.service
