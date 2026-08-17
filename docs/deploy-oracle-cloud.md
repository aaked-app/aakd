# Deploy Aakd on Oracle Cloud

Total time: approximately 30 minutes. Oracle Cloud pricing, availability, and free-tier terms can change, so verify current terms before deploying.

---

## What you'll get

- Aakd at `https://app.yourdomain.com`
- DocuSeal (e-signatures) at `https://sign.app.yourdomain.com`
- Auto-SSL via Let's Encrypt (Caddy)
- Daily PostgreSQL backups retained locally for seven days
- Up to 2 ARM OCPUs + 12 GB RAM on the current Always Free allocation

---

## Step 1 — Create Oracle Cloud account (5 min)

1. Go to **https://signup.cloud.oracle.com**
2. Sign up with your email
3. Enter a credit card (identity verification only — they do NOT charge you)
4. Select your home region — pick one close to your target users:
   - MENA: `UAE East (Dubai)` or `Saudi Arabia West (Jeddah)` ✅ (great for MENA data sovereignty)
   - Europe: `Germany Central (Frankfurt)`
   - US: `US East (Ashburn)`

---

## Step 2 — Create an ARM VM (10 min)

1. In Oracle Cloud Console → **Compute → Instances → Create instance**
2. Configure:
   - **Name:** `aakd`
   - **Image:** Ubuntu 22.04 (click "Change Image" → Ubuntu → 22.04 Minimal)
   - **Shape:** Click "Change Shape" → Ampere → `VM.Standard.A1.Flex`
     - OCPUs: **2**
     - Memory: **12 GB**
     - *(This is the Always Free allocation)*
3. **Add SSH key:** Click "Generate a key pair for me" → **Download both keys** → save them somewhere safe
4. Click **Create**
5. Wait ~2 minutes for the instance to start
6. Copy the **Public IP address** from the instance details page

---

## Step 3 — Point your domain to the VM (5 min)

You need a domain name. If you don't have one, get one at Namecheap (~$10/year) or use a free subdomain from DuckDNS.

**In Cloudflare (or your DNS provider):**

Add these DNS records:

| Type | Name | Value | Proxy |
|---|---|---|---|
| A | `app` | `YOUR_VM_IP` | DNS only (gray cloud) |
| A | `sign.app` | `YOUR_VM_IP` | DNS only (gray cloud) |

> ⚠️ Use "DNS only" (not proxied) for the first setup so Caddy can get SSL certificates directly.

Wait 1–2 minutes for DNS to propagate. Verify with: `nslookup app.yourdomain.com`

---

## Step 4 — Configure email (optional, 5 min)

Email is optional. Without it, the application still works, but invitations and renewal alerts are not delivered. Resend is the simplest option for transactional email and has a free tier, but any SMTP provider works.

1. Go to **https://resend.com** → Sign up
2. Go to **Domains** → Add your domain → follow the DNS instructions
3. Go to **API Keys** → Create API Key → copy it (starts with `re_...`)

---

## Step 5 — SSH into your VM (2 min)

```bash
# On your local machine:
chmod 400 ~/Downloads/ssh-key-*.key
ssh -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_VM_IP
```

If it connects, you're in. You'll see a Ubuntu welcome message.

---

## Step 6 — Clone repo and deploy (5 min)

On the VM, run:

```bash
# Install git if needed
sudo apt-get update && sudo apt-get install -y git

# Clone Aakd
git clone https://github.com/aaked-app/aakd.git ~/aakd
cd ~/aakd

# Make scripts executable
chmod +x scripts/*.sh

# Run the deploy script with one reviewed immutable release commit
AAKD_REF=<reviewed-40-character-commit-sha> bash scripts/deploy.sh
```

The script will:
- Install Docker automatically
- Ask for a domain and optional email settings
- Refuse floating branches and deploy only the supplied exact Git commit
- Auto-generate all passwords and secrets
- Build Docker images (~5 min first time)
- Start all services
- Validate the stack and wait for the app health endpoint

---

## Step 7 — First login (2 min)

1. Wait ~2 minutes for Caddy to get SSL certificates
2. Open `https://app.yourdomain.com`
3. Click **Sign up** — the first account is yours
4. Create your organization

---

## Step 8 — Set up DocuSeal for e-signatures (3 min)

1. Open `https://sign.app.yourdomain.com`
2. Create an admin account
3. Go to **Settings → API** → copy the API key
4. Back on your VM, run:
   ```bash
     bash ~/aakd/scripts/set-docuseal-key.sh YOUR_DOCUSEAL_API_KEY
   ```

E-signatures now work.

---

## Updating Aakd

```bash
cd ~/aakd
bash scripts/update.sh
```

The update pulls the latest code, rebuilds images, and restarts services. Expect a brief restart while the new containers come online.

---

## Useful commands

```bash
# View all logs
docker compose -f docker-compose.prod.yml logs -f

# View just the app logs
docker compose -f docker-compose.prod.yml logs -f app

# Check service status
docker compose -f docker-compose.prod.yml ps

# Run deployment diagnostics and export a host backup
bash scripts/doctor.sh
bash scripts/backup.sh

# Restart a specific service
docker compose -f docker-compose.prod.yml restart worker

# Run database migration manually
docker compose -f docker-compose.prod.yml exec app npx prisma migrate deploy

# Open a database shell
docker compose -f docker-compose.prod.yml exec db psql -U postgres clauseflow
```

---

## Backups

Backups run automatically every 24 hours and retain PostgreSQL dumps for seven
days in a Docker volume on the same host. They do **not** back up MinIO contract
files, DocuSeal data, or `.env.prod`; copy those to encrypted off-host storage
and complete a restore drill before relying on this deployment for recovery.

To download a backup:
```bash
# List backups
docker compose -f docker-compose.prod.yml exec backup ls /backups

# Copy a timestamped backup shown above to your local machine
scp -i ~/Downloads/ssh-key-*.key ubuntu@YOUR_VM_IP:/var/lib/docker/volumes/clauseflow_backups/_data/clauseflow-YYYYMMDD-HHMMSS.sql.gz .
```

---

## Cost breakdown

| Service | Cost |
|---|---|
| Oracle Cloud ARM VM (2 OCPU, 12 GB) | **$0/month (Always Free)** |
| Oracle Cloud block storage (50 GB) | **$0/month (Always Free)** |
| Cloudflare (DNS + proxy) | **$0/month** |
| Email provider (optional) | **$0+ / month** |
| Domain name | ~$10/year |
| **Total** | **~$0.83/month** |

---

## Oracle Cloud VCN Security List

Oracle Cloud has a second firewall layer called "Security List" in the VCN. Open ports 80 and 443 in the Oracle Cloud console. The installer does not modify host iptables by default; set `CONFIGURE_FIREWALL=true` only if you explicitly want that behavior:

1. In Oracle Cloud → **Networking → Virtual Cloud Networks → your VCN**
2. Click **Security Lists → Default Security List**
3. Click **Add Ingress Rules**:
   - Source CIDR: `0.0.0.0/0`, Protocol: TCP, Port: **80**
   - Source CIDR: `0.0.0.0/0`, Protocol: TCP, Port: **443**
   - Source CIDR: `0.0.0.0/0`, Protocol: UDP, Port: **443**

If you skip this, the app won't be reachable from the internet even though Docker is running.
