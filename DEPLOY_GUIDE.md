# ขึ้นระบบคีย์เลขที่ keelek.kuayrai.com

## รูปแบบ VPS ที่รองรับหลายระบบ

ใช้ Nginx บน VPS เป็นจุดรับ HTTPS กลาง แล้ว proxy ไปยัง web container ของแต่ละระบบผ่าน localhost

| ระบบ | ชื่อเว็บไซต์ | พอร์ต localhost | Compose project |
| --- | --- | --- | --- |
| คีย์เลข | keelek.kuayrai.com | 8081 | keelek |
| ระบบถัดไป | ชื่อระบบ.twiniiz.com | 8082 (ตัวอย่าง) | ชื่อระบบแยกกัน |
| ระบบเพิ่มเติม | ชื่อระบบ.kuayrai.com หรือโดเมนใหม่ | 8083 เป็นต้นไป | ชื่อระบบแยกกัน |

แต่ละระบบมี repo, Compose project, network, database volume และ secrets ของตัวเอง ไม่ใช้ container_name ร่วมกัน Nginx มี server block และใบรับรองแยกตาม subdomain จึงไม่ต้องย้ายระบบเดิมเมื่อเพิ่มโดเมน ไม่มีการตั้งค่า twiniiz.com จริงใน repo นี้ เพราะยังไม่มีระบบหรือชื่อ subdomain ของโดเมนนั้น

เฉพาะ Nginx กลางเปิด 80/443 ส่วน API และ MySQL ของคีย์เลขไม่มีพอร์ตสาธารณะ Web ของคีย์เลขรับที่ 127.0.0.1:8081 เท่านั้น

## 1. เตรียม VPS และ DNS

คู่มือนี้ใช้ Ubuntu 24.04 LTS ต้องทราบ OS จริงก่อนติดตั้ง หากเป็น OS อื่นให้ปรับขั้นตอนติดตั้งแพ็กเกจ

- สร้าง DNS A record: `keelek` ของ `kuayrai.com` ชี้ IPv4 ของ VPS
- สร้าง AAAA เฉพาะเมื่อ VPS มี IPv6 ที่เข้าถึงได้จริง
- เริ่มด้วย DNS only หากใช้ Cloudflare แล้วค่อยเปิด proxy หลัง HTTPS ใช้งานได้ ตั้ง SSL เป็น Full (strict)
- เปิด inbound SSH ตามพอร์ตที่ใช้จริง, TCP 80 และ 443 เท่านั้น อย่าเปิด MySQL 3306 หรือพอร์ต API
- ตรวจไฟร์วอลล์ผู้ให้บริการด้วย ก่อนเปิด UFW ต้องอนุญาต SSH พอร์ตจริง เพื่อไม่ให้หลุดจากเครื่อง

ติดตั้ง Docker Engine และ Compose plugin ตาม [คู่มือ Docker สำหรับ Ubuntu](https://docs.docker.com/engine/install/ubuntu/) ไม่ใช้ Docker Compose รุ่นเก่า `docker-compose`

```sh
sudo apt update
sudo apt install -y git nginx certbot python3-certbot-nginx openssl
sudo systemctl enable --now nginx docker
```

ตรวจ `docker version`, `docker compose version`, `nginx -v` และบริการที่ใช้พอร์ต 80/443/8081 ก่อนติดตั้ง หากมี Nginx หรือระบบอื่นอยู่แล้ว ให้ตรวจ config เดิมก่อน ไม่เขียนทับ nginx.conf กลาง

## 2. Clone และสร้าง secrets ใหม่บน VPS

```sh
sudo install -d -m 0750 -o "$USER" -g "$USER" /srv/apps/keelek
git clone https://github.com/athanhomemail/kee-lek.git /srv/apps/keelek
cd /srv/apps/keelek
sh deploy/scripts/init-env.sh
```

ถ้า repo เป็น private ใช้ SSH deploy key ที่อ่าน repo นี้ได้เท่านั้น หรือ Git credential helper ห้ามฝัง token ใน URL ของ remote

`deploy/.env` ถูกสร้างด้วย secrets สุ่มและ permission 600 ไม่เข้า Git ห้ามคัดลอก .env จากเครื่องพัฒนา หรือใช้ password/test1234 บน production ห้ามรัน seed:test บน VPS

ตรวจ `WEB_PORT=8081` ว่าไม่ชนระบบอื่น หากเปลี่ยน ต้องแก้ proxy_pass ของ Nginx ด้วย

## 3. เปิดระบบ

```sh
cd /srv/apps/keelek
docker compose --env-file deploy/.env -f deploy/compose.yml config --quiet
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --build --wait
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T api npm run seed
docker compose --env-file deploy/.env -f deploy/compose.yml ps
curl --fail http://127.0.0.1:8081/api/health
```

คำสั่ง Docker อาจต้อง sudo หากผู้ใช้ยังไม่มีสิทธิ์ Docker อย่าเพิ่มผู้ใช้เข้ากลุ่ม docker โดยไม่เข้าใจว่ากลุ่มนี้มีสิทธิ์เทียบเท่า root

ฐานข้อมูลใหม่เริ่มเฉพาะประเภทหวย ไม่มีโพย งวด Leader/Member หรือบัญชีทดสอบ จึงไม่ต้องล้างข้อมูลเครื่องพัฒนาเพื่อ deploy วิธีนี้

Admin เริ่มต้น `admintor`, `adminmike` ใช้รหัสสุ่มจาก `ADMIN_INITIAL_PASSWORD` ใน deploy/.env ดูรหัสเฉพาะบน VPS และเปลี่ยนรหัสผ่านครั้งแรกของแต่ละบัญชี ก่อนเปิดให้ผู้อื่นใช้ ระบบบังคับเปลี่ยนก่อนเข้าข้อมูล

## 4. Nginx กลางและ HTTPS

หลัง DNS ชี้ VPS และพอร์ต 80 เข้าถึงได้:

```sh
cd /srv/apps/keelek
sudo install -d /etc/nginx/snippets
sudo install -m 0644 deploy/nginx/websocket-map.conf /etc/nginx/conf.d/platform-websocket-map.conf
sudo install -m 0644 deploy/nginx/platform-proxy.conf /etc/nginx/snippets/platform-proxy.conf
sudo install -m 0644 deploy/nginx/keelek.kuayrai.com.conf /etc/nginx/sites-available/keelek.kuayrai.com.conf
sudo ln -s /etc/nginx/sites-available/keelek.kuayrai.com.conf /etc/nginx/sites-enabled/keelek.kuayrai.com.conf
sudo nginx -t
sudo systemctl reload nginx
sudo certbot --nginx -d keelek.kuayrai.com --redirect
sudo certbot renew --dry-run
```

ไฟล์ platform-* เป็นไฟล์ส่วนกลาง ติดตั้งครั้งแรกเท่านั้น ถ้ามีอยู่แล้วให้เทียบเนื้อหาก่อน ไม่เขียนทับระบบอื่น การรันซ้ำไม่ต้องสร้าง symlink เดิมอีก

Certbot จะเพิ่ม HTTPS และ redirect ใน config บน VPS ให้ตรวจ nginx -t ก่อน reload ทุกครั้ง อย่านำ HTTP bootstrap ใน Git ไปทับ config ที่ Certbot แก้แล้ว

ทดสอบ https://keelek.kuayrai.com, `/api/health`, Login, Socket.IO และ Copy รูป ระบบคัดลอกรูปต้อง HTTPS

## 5. เพิ่มระบบหรือโดเมนภายหลัง

1. ระบบใหม่ใช้โฟลเดอร์ `/srv/apps/<ระบบ>` และ Compose project ชื่อใหม่
2. เลือกพอร์ต localhost ใหม่ เช่น 8082 พร้อมฐานข้อมูลและ volume แยก
3. ใช้ deploy/nginx/subdomain.conf.example เปลี่ยน SUBDOMAIN.DOMAIN และ LOCAL_PORT เป็นค่าจริง แล้วติดตั้งเป็นไฟล์ใหม่
4. สร้าง DNS ของ subdomain และออกใบรับรอง `certbot --nginx -d <subdomain>` แยกต่อระบบ
5. ใช้ snippets ส่วนกลางชุดเดิม ไม่แก้ server block ของคีย์เลข

## สำรอง อัปเดต และกู้คืน

สำรอง MySQL:

```sh
cd /srv/apps/keelek
sh deploy/scripts/backup.sh
```

เก็บสำรองอีกชุดนอก VPS ด้วย การมีไฟล์อยู่ในเครื่องเดียวไม่ช่วยหาก VPS เสียทั้งหมด ตั้งงานสำรองรายวันเมื่อทราบวิธีเก็บสำรองจริง

อัปเดต:

```sh
cd /srv/apps/keelek
sh deploy/scripts/update.sh
```

สคริปต์ตรวจ working tree, สำรองก่อน, pull main แบบ ff-only และ build/up ใหม่ ข้อมูลอยู่ใน named volume Schema init จะทำงานเฉพาะ volume ใหม่ ถ้าอนาคตเปลี่ยน schema ต้องมี migration ตาม release ก่อนอัปเดต ห้าม down -v บน production

กู้คืนเป็นขั้นตอนที่ทับข้อมูล ต้องเลือกไฟล์และยืนยันกับผู้ดูแลก่อน ตัวอย่างคำสั่งหลังหยุดผู้ใช้งาน:

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml stop web api
gunzip -c backups/FILE.sql.gz > /tmp/keelek-restore.sql
docker compose --env-file deploy/.env -f deploy/compose.yml exec -T db sh -c 'MYSQL_PWD="$MYSQL_ROOT_PASSWORD" exec mysql -uroot keeled' < /tmp/keelek-restore.sql
rm /tmp/keelek-restore.sql
docker compose --env-file deploy/.env -f deploy/compose.yml up -d --wait
```

ไฟล์ restore ชั่วคราวมีข้อมูลสำคัญ ควรใช้ umask 077 ก่อนสร้างไฟล์ และเก็บ secrets/backup นอก Git เสมอ

อ่านการล้างข้อมูลใน [ADMIN-MAINTENANCE.md](ADMIN-MAINTENANCE.md) การล้างจาก UI เป็นการลบข้อมูลจริง ไม่ใช่ขั้นตอนที่ต้องทำเพื่อ clone ระบบใหม่

## ตรวจปัญหา

```sh
docker compose --env-file deploy/.env -f deploy/compose.yml logs --tail=100 api web db
sudo nginx -t
sudo tail -n 100 /var/log/nginx/keelek.error.log
```

หากเปลี่ยน MYSQL_PASSWORD ใน .env หลัง volume มีข้อมูลแล้ว ต้องเปลี่ยน password ใน MySQL ให้ตรงด้วย การแก้ env อย่างเดียวไม่หมุนรหัสฐานข้อมูล

อ้างอิง: [Nginx WebSocket](https://nginx.org/en/docs/http/websocket.html), [Docker Compose services](https://docs.docker.com/reference/compose-file/services/), [Certbot](https://certbot.eff.org/)
