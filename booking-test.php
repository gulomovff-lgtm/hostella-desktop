<?php
// ═══════════════════════════════════════════════════════════════
//  HOSTELLA — Страница онлайн-бронирования
//  Версия 2.0 | booking-test.php
// ═══════════════════════════════════════════════════════════════

define('DB_HOST', 'localhost');
define('DB_NAME', 'hostella_hostella_db');
define('DB_USER', 'hostella_hostella_db');
define('DB_PASS', 'uF6[rEf(.Aad.FX-');
define('CF_BASE', 'https://us-central1-hostella-app-a1e07.cloudfunctions.net');
define('PAYME_MERCHANT_ID', 'TEST_PAYME_MERCHANT_ID');
define('PAYME_CHECKOUT_URL', 'https://checkout.paycom.uz/');
define('CLICK_SERVICE_ID',  'TEST_CLICK_SERVICE_ID');
define('CLICK_MERCHANT_ID', 'TEST_CLICK_MERCHANT_ID');
define('CLICK_CHECKOUT_URL','https://my.click.uz/services/pay');
define('PAYMENT_SECRET', 'H0stell@_P@y_Secret_Key_2026_XZ!');

$PRICES = [
    'hostel1' => ['upper' => 70000, 'lower' => 80000],
    'hostel2' => ['upper' => 90000, 'lower' => 100000],
];
$CAPACITY = [
    'hostel1' => ['upper' => 10, 'lower' => 10],
    'hostel2' => ['upper' => 8,  'lower' => 8],
];

$db = null;
try {
    $db = new PDO("mysql:host=".DB_HOST.";dbname=".DB_NAME.";charset=utf8mb4", DB_USER, DB_PASS);
    $db->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $db->exec("CREATE TABLE IF NOT EXISTS bookings (
        id             INT AUTO_INCREMENT PRIMARY KEY,
        hostel         ENUM('hostel1','hostel2') NOT NULL,
        bed_type       ENUM('upper','lower') NOT NULL,
        beds_count     TINYINT NOT NULL DEFAULT 1,
        checkin        DATE NOT NULL,
        checkout       DATE NOT NULL,
        nights         TINYINT NOT NULL DEFAULT 1,
        amount         INT NOT NULL,
        guest_name     VARCHAR(200) NOT NULL,
        guest_phone    VARCHAR(30)  NOT NULL,
        guest_comment  TEXT,
        payment_method ENUM('payme','click','cash') DEFAULT 'cash',
        payment_status ENUM('pending','paid','cancelled') DEFAULT 'pending',
        payment_id     VARCHAR(100) DEFAULT '',
        pay_token      VARCHAR(500) DEFAULT '',
        firestore_id   VARCHAR(100) DEFAULT '',
        created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
} catch (PDOException $e) { $db = null; }

function encryptPayload(array $data): string {
    $json = json_encode($data, JSON_UNESCAPED_UNICODE);
    $iv   = random_bytes(12);
    $key  = substr(hash('sha256', PAYMENT_SECRET, true), 0, 32);
    $ct   = openssl_encrypt($json, 'aes-256-gcm', $key, OPENSSL_RAW_DATA, $iv, $tag);
    return base64_encode($iv . $tag . $ct);
}

function callCF(string $path, string $method = 'GET', array $payload = []): ?array {
    $url  = CF_BASE . $path;
    $opts = ['http' => ['method' => $method, 'timeout' => 8, 'ignore_errors' => true,
                        'header' => "Content-Type: application/json\r\n"]];
    if ($method === 'POST' && !empty($payload)) $opts['http']['content'] = json_encode($payload);
    $ctx  = stream_context_create($opts);
    $resp = @file_get_contents($url, false, $ctx);
    return $resp ? json_decode($resp, true) : null;
}

function paymeUrl(int $id, int $amt, string $phone): string {
    $p = 'm='.PAYME_MERCHANT_ID.';ac.booking_id='.$id.';ac.phone='.urlencode($phone).';a='.($amt*100).';l=ru';
    return PAYME_CHECKOUT_URL.base64_encode($p);
}

header('Vary: Accept');
if (!empty($_SERVER['HTTP_X_REQUESTED_WITH']) && strtolower($_SERVER['HTTP_X_REQUESTED_WITH']) === 'xmlhttprequest') {
    header('Content-Type: application/json; charset=utf-8');
    $action = $_POST['action'] ?? $_GET['action'] ?? '';

    if ($action === 'get_mysql_ranges') {
        $hostel  = in_array($_GET['hostel']   ?? '', ['hostel1','hostel2']) ? $_GET['hostel']   : 'hostel1';
        $bedType = in_array($_GET['bed_type'] ?? '', ['upper','lower'])     ? $_GET['bed_type'] : 'upper';
        global $db;
        $ranges = [];
        if ($db) {
            $stmt = $db->prepare("SELECT checkin, checkout, beds_count FROM bookings
                WHERE hostel=? AND bed_type=? AND payment_status != 'cancelled' AND checkout >= CURDATE()
                ORDER BY checkin");
            $stmt->execute([$hostel, $bedType]);
            while ($r = $stmt->fetch(PDO::FETCH_ASSOC)) {
                $ranges[] = ['checkIn'=>$r['checkin'].'T00:00:00.000Z','checkOut'=>$r['checkout'].'T00:00:00.000Z','bedsCount'=>(int)$r['beds_count']];
            }
        }
        echo json_encode(['ok' => true, 'ranges' => $ranges]); exit;
    }

    if ($action === 'check_availability') {
        $hostel   = in_array($_POST['hostel']   ?? '', ['hostel1','hostel2']) ? $_POST['hostel']   : 'hostel1';
        $bedType  = in_array($_POST['bed_type'] ?? '', ['upper','lower'])     ? $_POST['bed_type'] : 'upper';
        $checkin  = $_POST['checkin']  ?? '';
        $checkout = $_POST['checkout'] ?? '';
        global $db, $CAPACITY;
        $available = $CAPACITY[$hostel][$bedType];
        if ($db && $checkin && $checkout) {
            $stmt = $db->prepare("SELECT COALESCE(SUM(beds_count),0) AS booked FROM bookings
                WHERE hostel=? AND bed_type=? AND payment_status != 'cancelled' AND checkin < ? AND checkout > ?");
            $stmt->execute([$hostel, $bedType, $checkout, $checkin]);
            $available = max(0, $CAPACITY[$hostel][$bedType] - (int)$stmt->fetchColumn());
        }
        echo json_encode(['available' => $available, 'ok' => true]); exit;
    }

    if ($action === 'create_booking' && $_SERVER['REQUEST_METHOD'] === 'POST') {
        global $db, $PRICES, $CAPACITY;
        $hostel    = in_array($_POST['hostel']   ?? '', ['hostel1','hostel2']) ? $_POST['hostel']   : null;
        $bedType   = in_array($_POST['bed_type'] ?? '', ['upper','lower'])     ? $_POST['bed_type'] : null;
        $checkin   = $_POST['checkin']  ?? '';
        $checkout  = $_POST['checkout'] ?? '';
        $beds      = max(1, min(6, (int)($_POST['beds_count'] ?? 1)));
        $name      = trim(htmlspecialchars($_POST['guest_name']    ?? '', ENT_QUOTES));
        $phone     = trim(preg_replace('/[^\d\+\-\(\) ]/', '', $_POST['guest_phone'] ?? ''));
        $comment   = trim(htmlspecialchars($_POST['guest_comment'] ?? '', ENT_QUOTES));
        $payMethod = in_array($_POST['payment_method'] ?? '', ['payme','click','cash']) ? $_POST['payment_method'] : 'cash';
        $errors = [];
        if (!$hostel)  $errors[] = 'Выберите филиал';
        if (!$bedType) $errors[] = 'Выберите тип места';
        if (!$checkin || !$checkout || $checkout <= $checkin) $errors[] = 'Некорректные даты';
        if (strlen($name) < 2)  $errors[] = 'Укажите имя';
        if (strlen($phone) < 7) $errors[] = 'Укажите телефон';
        if ($errors) { echo json_encode(['ok'=>false,'errors'=>$errors]); exit; }
        $nights = max(1, (int)(new DateTime($checkin))->diff(new DateTime($checkout))->days);
        $pricePerBed = $PRICES[$hostel][$bedType] ?? 70000;
        $amount = $pricePerBed * $beds * $nights;
        if (!$db) { echo json_encode(['ok'=>false,'errors'=>['Ошибка подключения к БД']]); exit; }
        $stmt = $db->prepare("SELECT COALESCE(SUM(beds_count),0) AS booked FROM bookings
            WHERE hostel=? AND bed_type=? AND payment_status != 'cancelled' AND checkin < ? AND checkout > ?");
        $stmt->execute([$hostel, $bedType, $checkout, $checkin]);
        $available = max(0, $CAPACITY[$hostel][$bedType] - (int)$stmt->fetchColumn());
        if ($beds > $available) { echo json_encode(['ok'=>false,'errors'=>["Доступно только $available мест"]]); exit; }
        $stmt = $db->prepare("INSERT INTO bookings (hostel,bed_type,beds_count,checkin,checkout,nights,amount,guest_name,guest_phone,guest_comment,payment_method) VALUES (?,?,?,?,?,?,?,?,?,?,?)");
        $stmt->execute([$hostel,$bedType,$beds,$checkin,$checkout,$nights,$amount,$name,$phone,$comment,$payMethod]);
        $bookingId = (int)$db->lastInsertId();
        $token = encryptPayload(['booking_id'=>$bookingId,'amount'=>$amount,'phone'=>$phone,'method'=>$payMethod,'ts'=>time()]);
        $db->prepare("UPDATE bookings SET pay_token=? WHERE id=?")->execute([$token,$bookingId]);
        $firestoreId = '';
        $cfResp = callCF('/createWebBooking', 'POST', [
            'fullName'=>$name,'phone'=>$phone,'hostelId'=>$hostel,'bedType'=>$bedType,
            'bedsCount'=>$beds,'checkIn'=>$checkin.'T00:00:00.000Z','checkOut'=>$checkout.'T00:00:00.000Z',
            'nights'=>$nights,'amount'=>$amount,'pricePerDay'=>$pricePerBed*$beds,
            'paymentMethod'=>$payMethod,'paymentStatus'=>$payMethod==='cash'?'pending':'awaiting',
            'mysqlBookingId'=>$bookingId,'comment'=>$comment,
        ]);
        if (!empty($cfResp['firestoreId'])) {
            $firestoreId = $cfResp['firestoreId'];
            $db->prepare("UPDATE bookings SET firestore_id=? WHERE id=?")->execute([$firestoreId,$bookingId]);
        }
        $payUrl=''; $clickP=[];
        if ($payMethod==='payme') { $payUrl = paymeUrl($bookingId, $amount, $phone); }
        elseif ($payMethod==='click') {
            $clickP=['service_id'=>CLICK_SERVICE_ID,'merchant_id'=>CLICK_MERCHANT_ID,'amount'=>$amount,
                     'transaction_param'=>$bookingId,'return_url'=>(isset($_SERVER['HTTPS'])?'https://':'http://').$_SERVER['HTTP_HOST'].'/booking-test.php?paid='.$bookingId];
        }
        echo json_encode(['ok'=>true,'booking_id'=>$bookingId,'amount'=>$amount,'nights'=>$nights,'firestore'=>$firestoreId,'pay_url'=>$payUrl,'click_params'=>$clickP]);
        exit;
    }
    echo json_encode(['ok'=>false,'error'=>'Unknown action']); exit;
}

$paidMsg = '';
if (isset($_GET['paid']) && $db) {
    $bid = (int)$_GET['paid'];
    $row = $db->query("SELECT * FROM bookings WHERE id=$bid")->fetch(PDO::FETCH_ASSOC);
    if ($row) $paidMsg = $row['guest_name'];
}
?><!DOCTYPE html>
<html lang="ru">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Онлайн-бронирование — Hostella Ташкент</title>
<link rel="icon" href="/logo.png">
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;500;600;700;900&display=swap" rel="stylesheet">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
<style>
*{box-sizing:border-box;margin:0;padding:0}
:root{
  --accent:#E88C40;--accent2:#f0a855;--dark:#1a1f2e;
  --card:#fff;--text:#1a1f2e;--muted:#6b7280;--border:#e5e7eb;
  --green:#22c55e;--red:#ef4444;--amber:#f59e0b;
  --radius:16px;--shadow:0 4px 24px rgba(0,0,0,.10);
}
body{font-family:'Montserrat',sans-serif;background:#f4f6fb;color:var(--text);min-height:100vh}
.hdr{background:var(--dark);padding:16px 24px;display:flex;align-items:center;justify-content:space-between;position:sticky;top:0;z-index:100}
.hdr-logo{display:flex;align-items:center;gap:10px;color:#fff;text-decoration:none;font-weight:900;font-size:1.1rem}
.hdr-logo img{height:36px}
.hdr-back{color:rgba(255,255,255,.6);font-size:.82rem;text-decoration:none;display:flex;align-items:center;gap:6px;transition:color .2s}
.hdr-back:hover{color:#fff}
.wrap{max-width:660px;margin:0 auto;padding:18px 14px 48px}
.stepper{display:flex;align-items:center;gap:0;margin-bottom:20px}
.step{display:flex;align-items:center;gap:8px;flex:1}
.step-num{width:30px;height:30px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:.75rem;font-weight:900;flex-shrink:0;transition:all .3s}
.step-num.done{background:var(--green);color:#fff}
.step-num.active{background:var(--accent);color:#fff;box-shadow:0 0 0 4px rgba(232,140,64,.25)}
.step-num.idle{background:var(--border);color:var(--muted)}
.step-label{font-size:.74rem;font-weight:700;color:var(--muted)}
.step-label.active{color:var(--accent)}
.step-label.done{color:var(--green)}
.step-line{flex:1;height:2px;background:var(--border);margin:0 6px;border-radius:2px;min-width:18px;transition:background .4s}
.step-line.done{background:var(--green)}
.card{background:var(--card);border-radius:var(--radius);box-shadow:var(--shadow);padding:16px 18px;margin-bottom:10px}
.card-title{font-size:.9rem;font-weight:900;margin-bottom:12px;display:flex;align-items:center;gap:8px}
.card-title i{color:var(--accent);width:18px;text-align:center}
.choices{display:flex;gap:8px;flex-wrap:wrap}
.choice-btn{padding:9px 13px;border-radius:10px;border:2px solid var(--border);background:#fff;cursor:pointer;font-family:'Montserrat',sans-serif;font-size:.82rem;font-weight:700;display:flex;align-items:center;gap:8px;transition:all .2s;color:var(--text);text-align:left}
.choice-btn:hover{border-color:var(--accent);color:var(--accent)}
.choice-btn.selected{border-color:var(--accent);background:rgba(232,140,64,.07);color:var(--accent)}
.choice-btn .cb-badge{background:var(--border);color:var(--muted);font-size:.7rem;font-weight:700;padding:2px 8px;border-radius:20px;transition:all .2s;white-space:nowrap}
.choice-btn.selected .cb-badge{background:var(--accent);color:#fff}
.choice-btn.no-avail{opacity:.4;cursor:not-allowed;pointer-events:none}
.cal-top{display:flex;align-items:center;gap:14px;margin-bottom:16px;flex-wrap:wrap}
.cal-date-pill{background:rgba(232,140,64,.1);border-radius:10px;padding:8px 14px;min-width:120px}
.cal-date-pill .lbl{font-size:.65rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
.cal-date-pill .val{font-size:.92rem;font-weight:900;color:var(--accent);margin-top:2px}
.nights-pill{background:rgba(232,140,64,.15);border-radius:10px;padding:8px 12px;font-size:.86rem;font-weight:900;color:var(--accent);white-space:nowrap}
.live-price{font-size:.95rem;font-weight:900;color:var(--accent);background:rgba(232,140,64,.1);border-radius:10px;padding:8px 14px;white-space:nowrap}
.avail-loading{display:flex;align-items:center;gap:8px;font-size:.78rem;color:var(--muted);padding:6px 0;margin-bottom:8px}
.cal-wrap{display:flex;gap:18px;flex-wrap:wrap}
.cal{background:#fff;border:1px solid var(--border);border-radius:12px;padding:14px;min-width:250px;flex:1;max-width:320px}
.cal-head{display:flex;align-items:center;justify-content:space-between;margin-bottom:12px}
.cal-head-title{font-size:.86rem;font-weight:900}
.cal-nav{background:none;border:none;cursor:pointer;color:var(--muted);font-size:.9rem;width:26px;height:26px;display:flex;align-items:center;justify-content:center;border-radius:8px;transition:background .2s}
.cal-nav:hover:not(:disabled){background:var(--border)}
.cal-nav:disabled{opacity:.3;cursor:default}
.cal-grid{display:grid;grid-template-columns:repeat(7,1fr);gap:2px}
.cal-dow{font-size:.62rem;font-weight:700;color:var(--muted);text-align:center;padding:3px 0}
.cal-day{font-size:.76rem;font-weight:600;text-align:center;border-radius:7px;cursor:pointer;transition:all .12s;color:var(--text);position:relative;aspect-ratio:1;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:1px;padding:1px}
.cal-day:hover:not(.disabled):not(.empty):not(.fully-booked){background:rgba(232,140,64,.12)}
.cal-day.today{color:var(--accent);font-weight:900}
.cal-day.selected{background:var(--accent)!important;color:#fff!important;font-weight:900}
.cal-day.in-range{background:rgba(232,140,64,.12);color:var(--accent);border-radius:0}
.cal-day.range-start{border-radius:7px 0 0 7px}
.cal-day.range-end{border-radius:0 7px 7px 0}
.cal-day.disabled{color:#d1d5db;cursor:not-allowed;text-decoration:line-through}
.cal-day.fully-booked{color:#d1d5db;cursor:not-allowed;background:#fef2f2}
.cal-day.empty{cursor:default}
.avail-dot{width:4px;height:4px;border-radius:50%;flex-shrink:0;transition:background .2s}
.avail-dot.green{background:var(--green)}
.avail-dot.amber{background:var(--amber)}
.avail-dot.red{background:var(--red)}
.avail-dot.hidden{opacity:0}
.cal-legend{display:flex;gap:12px;flex-wrap:wrap;margin-top:12px;font-size:.7rem;color:var(--muted);font-weight:600}
.cal-legend span{display:flex;align-items:center;gap:5px}
.legend-dot{width:8px;height:8px;border-radius:50%;display:inline-block;flex-shrink:0}
.counter{display:flex;align-items:center;gap:12px;margin-top:4px}
.cnt-btn{width:34px;height:34px;border-radius:10px;border:2px solid var(--border);background:#fff;cursor:pointer;font-size:.95rem;display:flex;align-items:center;justify-content:center;transition:all .2s;font-weight:700}
.cnt-btn:hover:not(:disabled){border-color:var(--accent);color:var(--accent)}
.cnt-btn:disabled{opacity:.4;cursor:not-allowed}
.cnt-val{font-size:1.3rem;font-weight:900;min-width:26px;text-align:center}
.cnt-info{font-size:.75rem;color:var(--muted)}
.avail-bar{padding:9px 13px;border-radius:10px;font-size:.8rem;font-weight:600;display:none;align-items:center;gap:8px;margin-top:12px}
.avail-bar.show{display:flex}
.avail-bar.ok{background:#f0fdf4;color:#15803d;border:1px solid #bbf7d0}
.avail-bar.warn{background:#fffbeb;color:#b45309;border:1px solid #fde68a}
.avail-bar.none{background:#fef2f2;color:#dc2626;border:1px solid #fecaca}
.form-row{display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:16px}
.form-row.single{grid-template-columns:1fr}
.fld label{display:block;font-size:.7rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em;margin-bottom:5px}
.fld input,.fld textarea{width:100%;padding:10px 13px;border:2px solid var(--border);border-radius:10px;font-family:'Montserrat',sans-serif;font-size:.88rem;outline:none;transition:border .2s}
.fld input:focus,.fld textarea:focus{border-color:var(--accent)}
.fld input.error,.fld textarea.error{border-color:var(--red)}
.fld textarea{resize:vertical;min-height:72px}
.summary-box{background:linear-gradient(135deg,#1e2740,#2a3555);border-radius:14px;padding:18px 20px;color:#fff;margin-bottom:18px}
.sum-row{display:flex;justify-content:space-between;align-items:center;padding:5px 0;gap:8px;font-size:.83rem}
.sum-row+.sum-row{border-top:1px solid rgba(255,255,255,.08)}
.sum-row.total{font-size:1rem;font-weight:900;border-top:1px solid rgba(255,255,255,.25)!important;padding-top:10px;margin-top:4px}
.sum-row .lbl{color:rgba(255,255,255,.6)}
.sum-row .val{font-weight:700}
.pay-methods{display:flex;flex-direction:column;gap:10px;margin-bottom:18px}
.pay-opt{display:flex;align-items:center;gap:12px;padding:11px 15px;border:2px solid var(--border);border-radius:12px;cursor:pointer;transition:all .2s;user-select:none}
.pay-opt:hover{border-color:var(--accent)}
.pay-opt.selected{border-color:var(--accent);background:rgba(232,140,64,.06)}
.pay-opt input[type=radio]{accent-color:var(--accent);width:16px;height:16px;flex-shrink:0}
.pay-opt-name{font-size:.87rem;font-weight:700}
.pay-opt-desc{font-size:.72rem;color:var(--muted);margin-top:1px}
.pay-logo{font-weight:900}
.pay-logo.payme{color:#00A6B0}
.pay-logo.click{color:#E03}
.btn-primary{background:linear-gradient(135deg,var(--accent),var(--accent2));color:#fff;border:none;padding:12px 28px;border-radius:12px;font-family:'Montserrat',sans-serif;font-size:.9rem;font-weight:900;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:8px;letter-spacing:.04em}
.btn-primary:hover:not(:disabled){transform:translateY(-2px);box-shadow:0 6px 20px rgba(232,140,64,.45)}
.btn-primary:disabled{opacity:.55;cursor:not-allowed;transform:none;box-shadow:none}
.btn-secondary{background:#fff;color:var(--text);border:2px solid var(--border);padding:10px 22px;border-radius:12px;font-family:'Montserrat',sans-serif;font-size:.87rem;font-weight:700;cursor:pointer;transition:all .2s;display:inline-flex;align-items:center;gap:8px}
.btn-secondary:hover{border-color:var(--muted)}
.btn-row{display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-top:4px}
.err-box{background:#fef2f2;border:1px solid #fecaca;border-radius:10px;padding:11px 15px;margin-bottom:14px;font-size:.83rem;color:#dc2626;display:none}
.err-box.show{display:flex;align-items:flex-start;gap:8px}
.success-screen{text-align:center;padding:44px 20px}
.success-icon{width:72px;height:72px;background:linear-gradient(135deg,#22c55e,#16a34a);border-radius:50%;display:flex;align-items:center;justify-content:center;margin:0 auto 20px;font-size:1.8rem;color:#fff}
.success-screen h2{font-size:1.35rem;font-weight:900;margin-bottom:8px}
.success-screen p{color:var(--muted);margin-bottom:20px;font-size:.88rem;line-height:1.5}
.booking-id-badge{display:inline-block;background:var(--accent);color:#fff;font-size:.85rem;font-weight:900;padding:6px 18px;border-radius:20px;letter-spacing:.06em;margin-bottom:6px}
.spinner-sm{display:inline-block;width:14px;height:14px;border:2px solid rgba(255,255,255,.35);border-top-color:#fff;border-radius:50%;animation:spin .7s linear infinite}
@keyframes spin{to{transform:rotate(360deg)}}
.modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,.5);z-index:200;display:none;align-items:center;justify-content:center;padding:20px}
.modal-overlay.open{display:flex}
.modal-box{background:#fff;border-radius:18px;padding:24px;max-width:400px;width:100%;box-shadow:0 20px 60px rgba(0,0,0,.22);animation:pop .22s ease}
@keyframes pop{from{transform:scale(.93);opacity:0}to{transform:scale(1);opacity:1}}
.modal-box h3{font-size:1rem;font-weight:900;margin-bottom:14px;display:flex;align-items:center;gap:8px}
.modal-box .sum-row{font-size:.83rem}
.modal-actions{display:flex;gap:10px;margin-top:18px}
.modal-actions .btn-primary{flex:1;justify-content:center}
@media(max-width:640px){.form-row{grid-template-columns:1fr}.cal-wrap{flex-direction:column}.choices{flex-direction:column}.card{padding:16px}.cal{max-width:100%}}
#click-form{display:none}
</style>
</head>
<body>

<header class="hdr">
  <a href="/" class="hdr-logo"><img src="logo.png" alt="Hostella">Hostella</a>
  <a href="/" class="hdr-back"><i class="fas fa-arrow-left"></i> На сайт</a>
</header>

<?php if ($paidMsg): ?>
<div class="wrap">
  <div class="card success-screen">
    <div class="success-icon"><i class="fas fa-check"></i></div>
    <h2>Оплата получена!</h2>
    <p>Уважаемый(ая) <strong><?= htmlspecialchars($paidMsg) ?></strong>, ваше бронирование подтверждено.</p>
    <div class="booking-id-badge">Заказ #<?= (int)$_GET['paid'] ?></div><br><br>
    <a href="/" class="btn-primary" style="text-decoration:none"><i class="fas fa-home"></i> На главную</a>
  </div>
</div>
<?php else: ?>

<div class="wrap">
  <div class="stepper" id="stepper">
    <div class="step"><div class="step-num active" id="sn1">1</div><div class="step-label active" id="sl1">Параметры</div></div>
    <div class="step-line" id="line1"></div>
    <div class="step"><div class="step-num idle" id="sn2">2</div><div class="step-label" id="sl2">Данные</div></div>
    <div class="step-line" id="line2"></div>
    <div class="step"><div class="step-num idle" id="sn3">3</div><div class="step-label" id="sl3">Оплата</div></div>
  </div>

  <div id="step1">
    <div class="card">
      <div class="card-title"><i class="fas fa-map-marker-alt"></i> Филиал</div>
      <div class="choices">
        <button class="choice-btn selected" data-hostel="hostel1" onclick="selectHostel('hostel1',this)">
          <i class="fas fa-building"></i>
          <div><div>Хостел №1</div><div style="font-size:.69rem;font-weight:500;color:inherit;margin-top:1px">ул. Ниёзбек Йули, 43</div></div>
        </button>
        <button class="choice-btn" data-hostel="hostel2" onclick="selectHostel('hostel2',this)">
          <i class="fas fa-building"></i>
          <div><div>Хостел №2</div><div style="font-size:.69rem;font-weight:500;color:inherit;margin-top:1px">6-й пр. Ниёзбек Йули, 39</div></div>
        </button>
      </div>
      <div style="border-top:1px solid var(--border);margin:12px -18px;"></div>
      <div class="card-title"><i class="fas fa-bed"></i> Тип места</div>
      <div class="choices">
        <button class="choice-btn selected" data-bed="upper" onclick="selectBed('upper',this)">
          <i class="fas fa-arrow-up"></i>
          <div><div>Верхнее место</div><div style="font-size:.69rem;font-weight:500;color:inherit;margin-top:1px" id="price-upper">70 000 сум / ночь</div></div>
          <span class="cb-badge" id="avail-upper-badge">…</span>
        </button>
        <button class="choice-btn" data-bed="lower" onclick="selectBed('lower',this)">
          <i class="fas fa-arrow-down"></i>
          <div><div>Нижнее место</div><div style="font-size:.69rem;font-weight:500;color:inherit;margin-top:1px" id="price-lower">80 000 сум / ночь</div></div>
          <span class="cb-badge" id="avail-lower-badge">…</span>
        </button>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><i class="fas fa-calendar-alt"></i> Даты проживания</div>
      <div class="cal-top">
        <div style="display:flex;gap:12px;flex-wrap:wrap">
          <div class="cal-date-pill"><div class="lbl">Заезд</div><div class="val" id="display-checkin">Выберите…</div></div>
          <div class="cal-date-pill"><div class="lbl">Выезд</div><div class="val" id="display-checkout">Выберите…</div></div>
        </div>
        <div id="nights-pill" class="nights-pill" style="display:none"></div>
        <div id="live-price" class="live-price" style="display:none"></div>
      </div>
      <div id="avail-loading" class="avail-loading">
        <span class="spinner-sm" style="border-color:rgba(107,114,128,.3);border-top-color:var(--muted)"></span>
        Загрузка доступности…
      </div>
      <div class="cal-wrap" id="cal-wrap"></div>
      <div class="cal-legend">
        <span><span class="legend-dot" style="background:var(--green)"></span>Свободно</span>
        <span><span class="legend-dot" style="background:var(--amber)"></span>1–2 места</span>
        <span><span class="legend-dot" style="background:var(--red)"></span>Занято</span>
        <span><span class="legend-dot" style="background:#d1d5db"></span>Не доступно</span>
      </div>
    </div>

    <div class="card">
      <div class="card-title"><i class="fas fa-users"></i> Количество мест</div>
      <div class="counter">
        <button class="cnt-btn" id="btn-minus" onclick="changeBeds(-1)" disabled>−</button>
        <div class="cnt-val" id="beds-val">1</div>
        <button class="cnt-btn" id="btn-plus"  onclick="changeBeds(+1)">+</button>
        <div class="cnt-info" id="beds-info">место</div>
      </div>
      <div class="avail-bar" id="avail-bar"><i class="fas fa-circle-info"></i><span id="avail-text"></span></div>
    </div>

    <div class="btn-row">
      <button class="btn-primary" id="btn-step1" onclick="goStep2()" disabled>Далее <i class="fas fa-arrow-right"></i></button>
      <div style="font-size:.76rem;color:var(--muted)" id="step1-hint">Выберите дату заезда</div>
    </div>
  </div>

  <div id="step2" style="display:none">
    <div class="card">
      <div class="card-title"><i class="fas fa-user"></i> Данные гостя</div>
      <div class="form-row">
        <div class="fld"><label>Имя и фамилия *</label><input type="text" id="guest-name" placeholder="Алишер Иванов" autocomplete="name"></div>
        <div class="fld"><label>Телефон *</label><input type="tel" id="guest-phone" placeholder="+998 90 123 45 67" autocomplete="tel"></div>
      </div>
      <div class="form-row single">
        <div class="fld"><label>Комментарий</label><textarea id="guest-comment" placeholder="Особые пожелания, время прибытия…"></textarea></div>
      </div>
    </div>
    <div class="summary-box" id="summary-box"></div>
    <div class="btn-row">
      <button class="btn-secondary" onclick="goStep1()"><i class="fas fa-arrow-left"></i> Назад</button>
      <button class="btn-primary" onclick="validateStep2()">К оплате <i class="fas fa-arrow-right"></i></button>
    </div>
  </div>

  <div id="step3" style="display:none">
    <div class="card">
      <div class="card-title"><i class="fas fa-credit-card"></i> Способ оплаты</div>
      <div class="err-box" id="err-box"><i class="fas fa-circle-exclamation" style="flex-shrink:0"></i><span id="err-text"></span></div>
      <div class="pay-methods">
        <label class="pay-opt selected" onclick="selectPay('payme',this)">
          <input type="radio" name="pay" value="payme" checked>
          <div><div class="pay-opt-name"><span class="pay-logo payme">Payme</span></div><div class="pay-opt-desc">Humo, Uzcard, Visa, Mastercard</div></div>
          <i class="fas fa-lock" style="color:var(--green);font-size:.78rem;margin-left:auto"></i>
        </label>
        <label class="pay-opt" onclick="selectPay('click',this)">
          <input type="radio" name="pay" value="click">
          <div><div class="pay-opt-name"><span class="pay-logo click">Click</span></div><div class="pay-opt-desc">Humo, Uzcard через Click</div></div>
          <i class="fas fa-lock" style="color:var(--green);font-size:.78rem;margin-left:auto"></i>
        </label>
        <label class="pay-opt" onclick="selectPay('cash',this)">
          <input type="radio" name="pay" value="cash">
          <div><div class="pay-opt-name">Наличными при заселении</div><div class="pay-opt-desc">Оплата при заезде</div></div>
          <i class="fas fa-money-bill-wave" style="color:var(--muted);font-size:.78rem;margin-left:auto"></i>
        </label>
      </div>
      <div style="background:#f0fdf4;border:1px solid #bbf7d0;border-radius:10px;padding:10px 14px;font-size:.75rem;color:#15803d;display:flex;gap:8px;align-items:flex-start;margin-bottom:18px">
        <i class="fas fa-shield-alt" style="margin-top:2px;flex-shrink:0"></i>
        <div>Данные шифруются <strong>AES-256-GCM</strong>. Номер карты мы не получаем — оплата через Payme / Click.</div>
      </div>
      <div class="summary-box" id="summary-box2"></div>
      <div class="btn-row">
        <button class="btn-secondary" onclick="goStep2()"><i class="fas fa-arrow-left"></i> Назад</button>
        <button class="btn-primary" id="btn-pay" onclick="openConfirmModal()">
          <i class="fas fa-lock"></i> <span id="btn-pay-label">Оплатить</span>
        </button>
      </div>
    </div>
  </div>

  <div id="step4" style="display:none">
    <div class="card success-screen">
      <div class="success-icon"><i class="fas fa-check"></i></div>
      <h2 id="success-title">Бронирование принято!</h2>
      <p id="success-text">Мы свяжемся с вами для подтверждения.</p>
      <div class="booking-id-badge" id="success-bid"></div>
      <div style="margin-top:22px;display:flex;gap:12px;justify-content:center;flex-wrap:wrap">
        <a href="/" class="btn-primary" style="text-decoration:none"><i class="fas fa-home"></i> Главная</a>
        <a href="https://t.me/hostel_hostella_tashkent" class="btn-secondary" style="text-decoration:none" target="_blank"><i class="fab fa-telegram"></i> Telegram</a>
      </div>
    </div>
  </div>
</div>

<div class="modal-overlay" id="confirm-modal">
  <div class="modal-box">
    <h3><i class="fas fa-clipboard-check" style="color:var(--accent)"></i>Подтвердите бронирование</h3>
    <div id="modal-summary"></div>
    <div class="modal-actions">
      <button class="btn-secondary" onclick="closeConfirmModal()"><i class="fas fa-xmark"></i></button>
      <button class="btn-primary" id="btn-confirm" onclick="submitBooking()">
        <i class="fas fa-lock"></i> <span id="btn-confirm-label">Оплатить</span>
      </button>
    </div>
  </div>
</div>

<form id="click-form" method="POST" target="_blank">
  <input type="hidden" name="service_id"       id="cf-service">
  <input type="hidden" name="merchant_id"       id="cf-merchant">
  <input type="hidden" name="amount"            id="cf-amount">
  <input type="hidden" name="transaction_param" id="cf-txn">
  <input type="hidden" name="return_url"        id="cf-return">
</form>

<?php endif; ?>

<script>
const CF_BASE   = 'https://us-central1-hostella-app-a1e07.cloudfunctions.net';
const PRICES    = { hostel1:{upper:70000,lower:80000}, hostel2:{upper:90000,lower:100000} };
const CAPACITY  = { hostel1:{upper:10,lower:10},       hostel2:{upper:8,lower:8} };
const HOSTEL_NAMES = {
  hostel1:'Хостел №1 — ул. Ниёзбек Йули, 43',
  hostel2:'Хостел №2 — 6-й пр. Ниёзбек Йули, 39',
};
const BED_NAMES = { upper:'Верхнее место', lower:'Нижнее место' };
const MONTHS    = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAYS      = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];

const S = {
  hostel:'hostel1', bedType:'upper', checkin:null, checkout:null, beds:1, payMethod:'payme',
  maxAvail:{upper:0,lower:0}, heatmaps:{upper:{},lower:{}}, heatmapsLoaded:{upper:false,lower:false},
};
let calOffset = 0, calPick = 'checkin';

/* ── ТЕПЛОВАЯ КАРТА ── */
async function loadHeatmapForType(hostel, bedType) {
  S.heatmapsLoaded[bedType] = false; S.heatmaps[bedType] = {};
  const today = new Date(); today.setHours(0,0,0,0);

  const [fbRanges, mysqlRanges] = await Promise.allSettled([
    fetch(CF_BASE+'/getAvailability?hostelId='+hostel+'&bedType='+bedType)
      .then(r=>r.json()).then(d=>d.ranges||[]).catch(()=>[]),
    fetch(location.pathname+'?action=get_mysql_ranges&hostel='+hostel+'&bed_type='+bedType,
      {headers:{'X-Requested-With':'XMLHttpRequest'}})
      .then(r=>r.json()).then(d=>d.ranges||[]).catch(()=>[]),
  ]);

  const allRanges=[
    ...(fbRanges.status==='fulfilled'?fbRanges.value:[]),
    ...(mysqlRanges.status==='fulfilled'?mysqlRanges.value:[]),
  ];

  const cap=CAPACITY[hostel][bedType], hm={};
  for(let i=0;i<180;i++){const d=new Date(today);d.setDate(d.getDate()+i);hm[fmtISO(d)]=0;}

  for(const r of allRanges){
    if(!r.checkIn||!r.checkOut)continue;
    const ci=new Date(r.checkIn);ci.setHours(0,0,0,0);
    const co=new Date(r.checkOut);co.setHours(0,0,0,0);
    const cnt=r.bedsCount||1;
    for(const iso of Object.keys(hm)){
      const d=new Date(iso+'T00:00:00');
      if(d>=ci&&d<co)hm[iso]=(hm[iso]||0)+cnt;
    }
  }
  for(const iso of Object.keys(hm)) hm[iso]=Math.max(0,cap-hm[iso]);
  S.heatmaps[bedType]=hm; S.heatmapsLoaded[bedType]=true;
}

async function loadAllHeatmaps(hostel) {
  document.getElementById('avail-loading').style.display = 'flex';
  await Promise.all(['upper','lower'].map(bt => loadHeatmapForType(hostel, bt)));
  document.getElementById('avail-loading').style.display='none';
  if(S.checkin&&S.checkout) updateAvailForRange(S.checkin,S.checkout);
  renderCalendars();
  refreshBadges();
}

function minAvailInRange(ci,co,bedType){
  const bt=bedType||S.bedType;
  if(!ci||!co) return CAPACITY[S.hostel][bt];
  const d0=new Date(ci+'T00:00:00'),d1=new Date(co+'T00:00:00');
  let min=CAPACITY[S.hostel][bt];
  for(const[iso,av] of Object.entries(S.heatmaps[bt]||{})){
    const d=new Date(iso+'T00:00:00');
    if(d>=d0&&d<d1) min=Math.min(min,av);
  }
  return min;
}

function updateAvailForRange(ci,co){
  const av=minAvailInRange(ci,co);
  S.maxAvail[S.bedType]=av;
  updateAvailBar(av);
  refreshBadges();
}

function refreshBadges(){
  for(const bt of['upper','lower']){
    const badge=document.getElementById('avail-'+bt+'-badge');
    if(!badge) continue;
    if(!S.heatmapsLoaded[bt]){badge.textContent='…';continue;}
    if(S.checkin&&S.checkout){
      // Full range selected — show min availability over the range
      const av=minAvailInRange(S.checkin,S.checkout,bt);
      badge.textContent=av>0?av+' св.':'0';
      badge.closest('.choice-btn')?.classList.toggle('no-avail',av===0);
    } else if(S.checkin){
      // Only checkin selected — show availability on that day
      const av=(S.heatmaps[bt]||{})[S.checkin]??CAPACITY[S.hostel][bt];
      badge.textContent=av>0?av+' св.':'0';
      badge.closest('.choice-btn')?.classList.toggle('no-avail',av===0);
    } else {
      // No dates — show total capacity
      badge.textContent=CAPACITY[S.hostel][bt]+' мест';
      badge.closest('.choice-btn')?.classList.remove('no-avail');
    }
  }
}

/* ── ХОСТЕЛ / ТИП ── */
function selectHostel(h){
  S.hostel=h; S.checkin=S.checkout=null; calPick='checkin';
  document.querySelectorAll('[data-hostel]').forEach(b=>b.classList.toggle('selected',b.dataset.hostel===h));
  updatePriceLabels(); resetDateDisplay(); loadAllHeatmaps(h);
}
function selectBed(b){
  S.bedType=b;
  document.querySelectorAll('[data-bed]').forEach(el=>el.classList.toggle('selected',el.dataset.bed===b));
  if(S.checkin&&S.checkout) updateAvailForRange(S.checkin,S.checkout);
  renderCalendars(); checkStep1();
}
function updatePriceLabels(){
  const p=PRICES[S.hostel];
  document.getElementById('price-upper').textContent=fmt(p.upper)+' сум / ночь';
  document.getElementById('price-lower').textContent=fmt(p.lower)+' сум / ночь';
}

/* ── КОЛИЧЕСТВО МЕСТ ── */
function changeBeds(d){
  const max=S.maxAvail[S.bedType]||CAPACITY[S.hostel][S.bedType];
  S.beds=Math.max(1,Math.min(max,S.beds+d));
  document.getElementById('beds-val').textContent=S.beds;
  const w=S.beds;
  document.getElementById('beds-info').textContent=w===1?'место':w<5?'места':'мест';
  document.getElementById('btn-minus').disabled=S.beds<=1;
  document.getElementById('btn-plus').disabled=S.beds>=max;
  updateLivePrice(); checkStep1();
}

/* ── КАЛЕНДАРЬ ── */
function renderCalendars(){
  const wrap=document.getElementById('cal-wrap'); wrap.innerHTML='';
  for(let i=0;i<2;i++){
    const d=new Date(); d.setDate(1); d.setMonth(d.getMonth()+calOffset+i);
    wrap.appendChild(buildCal(d.getFullYear(),d.getMonth()));
  }
}
function buildCal(year,month){
  const today=new Date();today.setHours(0,0,0,0);
  const first=new Date(year,month,1);
  const last =new Date(year,month+1,0);
  const wrap=document.createElement('div'); wrap.className='cal';

  const curStart=new Date(today.getFullYear(),today.getMonth(),1);
  const thisStart=new Date(year,month,1);
  const head=document.createElement('div'); head.className='cal-head';
  head.innerHTML=`<button class="cal-nav" onclick="calNav(-1)" ${thisStart<=curStart?'disabled':''}><i class="fas fa-chevron-left"></i></button>
    <span class="cal-head-title">${MONTHS[month]} ${year}</span>
    <button class="cal-nav" onclick="calNav(+1)"><i class="fas fa-chevron-right"></i></button>`;
  wrap.appendChild(head);

  const grid=document.createElement('div'); grid.className='cal-grid';
  DAYS.forEach(d=>{const el=document.createElement('div');el.className='cal-dow';el.textContent=d;grid.appendChild(el);});

  let dow=first.getDay(); dow=dow===0?6:dow-1;
  for(let i=0;i<dow;i++){const el=document.createElement('div');el.className='cal-day empty';grid.appendChild(el);}

  const ci=S.checkin ?new Date(S.checkin +'T00:00:00'):null;
  const co=S.checkout?new Date(S.checkout+'T00:00:00'):null;

  for(let day=1;day<=last.getDate();day++){
    const date=new Date(year,month,day);
    const iso=fmtISO(date);
    const el=document.createElement('div'); el.className='cal-day';

    const num=document.createElement('span'); num.textContent=day; el.appendChild(num);
    const dot=document.createElement('div'); dot.className='avail-dot hidden'; el.appendChild(dot);

    if(date<today){
      el.classList.add('disabled');
    } else {
      if(date.getTime()===today.getTime()) el.classList.add('today');

      const hm=S.heatmaps[S.bedType]||{}, loaded=S.heatmapsLoaded[S.bedType];
      if(loaded&&iso in hm){
        const av=hm[iso];
        if(av===0){
          el.classList.add('fully-booked'); dot.className='avail-dot red';
          el.title='Мест нет';
        } else if(av<=2){
          dot.className='avail-dot amber'; el.title='Осталось '+av+' место(а)';
        } else {
          dot.className='avail-dot green'; el.title='Доступно '+av+' мест';
        }
      } else if(loaded){
        dot.className='avail-dot green';
      }

      if(ci&&date.getTime()===ci.getTime()){el.classList.add('selected','range-start');}
      if(co&&date.getTime()===co.getTime()){el.classList.add('selected','range-end');}
      if(ci&&co&&date>ci&&date<co){el.classList.add('in-range');}

      if(!el.classList.contains('fully-booked')){
        el.addEventListener('click',()=>pickDay(iso));
      }
    }
    grid.appendChild(el);
  }
  wrap.appendChild(grid);
  return wrap;
}

function pickDay(iso){
  if(calPick==='checkin'||(S.checkin&&iso<=S.checkin)){
    S.checkin=iso; S.checkout=null; calPick='checkout';
    updateDateDisplay(); renderCalendars(); refreshBadges(); checkStep1(); return;
  }
  if(iso>S.checkin){
    const d0=new Date(S.checkin+'T00:00:00'), d1=new Date(iso+'T00:00:00');
    let block=false;
    for(const[d,av] of Object.entries(S.heatmaps[S.bedType]||{})){
      const dt=new Date(d+'T00:00:00');
      if(dt>d0&&dt<d1&&av===0){block=true;break;}
    }
    if(block){S.checkin=iso;S.checkout=null;calPick='checkout';refreshBadges();}
    else{S.checkout=iso;calPick='checkin';updateAvailForRange(S.checkin,S.checkout);}
  } else {S.checkin=iso;S.checkout=null;calPick='checkout';refreshBadges();}
  updateDateDisplay(); renderCalendars(); checkStep1();
}
function calNav(dir){calOffset=Math.max(0,calOffset+dir);renderCalendars();}

/* ── ДАТЫ / ЦЕНА ── */
function resetDateDisplay(){
  document.getElementById('display-checkin').textContent='Выберите…';
  document.getElementById('display-checkout').textContent='Выберите…';
  document.getElementById('nights-pill').style.display='none';
  document.getElementById('live-price').style.display='none';
  renderCalendars();
}
function updateDateDisplay(){
  document.getElementById('display-checkin').textContent=S.checkin?dispDate(S.checkin):'Выберите…';
  document.getElementById('display-checkout').textContent=S.checkout?dispDate(S.checkout):'Выберите…';
  const n=countNights();
  const np=document.getElementById('nights-pill');
  np.style.display=n>0?'':'none';
  if(n>0) np.textContent=n+' '+(n===1?'ночь':n<5?'ночи':'ночей');
  updateLivePrice();
}
function updateLivePrice(){
  const n=countNights(); const lp=document.getElementById('live-price');
  if(n>0&&S.beds>0){lp.textContent=fmt(PRICES[S.hostel][S.bedType]*S.beds*n)+' сум';lp.style.display='';}
  else lp.style.display='none';
}
function updateAvailBar(av){
  const bar=document.getElementById('avail-bar');
  const txt=document.getElementById('avail-text');
  bar.classList.remove('ok','warn','none');
  if(av===0){bar.classList.add('show','none');txt.textContent='На эти даты мест нет.';}
  else if(av<=2){bar.classList.add('show','warn');txt.textContent='Осталось '+av+(av===1?' место':' места')+'!';}
  else{bar.classList.add('show','ok');txt.textContent='Доступно '+av+' мест на эти даты.';}
  const max=av||CAPACITY[S.hostel][S.bedType];
  if(S.beds>max){S.beds=max;document.getElementById('beds-val').textContent=S.beds;}
  document.getElementById('btn-minus').disabled=S.beds<=1;
  document.getElementById('btn-plus').disabled=S.beds>=max;
}

/* ── ХЕЛПЕРЫ ── */
function fmtISO(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
function pad(n){return String(n).padStart(2,'0');}
function countNights(){if(!S.checkin||!S.checkout)return 0;return Math.round((new Date(S.checkout)-new Date(S.checkin))/86400000);}
function dispDate(iso){const d=new Date(iso+'T00:00:00');return d.getDate()+' '+MONTHS[d.getMonth()].slice(0,3)+' '+d.getFullYear();}
function fmt(n){return Number(n).toLocaleString('ru-RU');}

/* ── ШАГИ ── */
function checkStep1(){
  const av=S.maxAvail[S.bedType];
  const ok=S.checkin&&S.checkout&&av>=S.beds&&S.beds>=1;
  document.getElementById('btn-step1').disabled=!ok;
  document.getElementById('step1-hint').textContent=ok?'':
    !S.checkin?'Выберите дату заезда':!S.checkout?'Выберите дату выезда':
    av===0?'⚠ Мест на эти даты нет':'Выберите даты';
}
function setStep(n){
  for(let i=1;i<=3;i++){
    const num=document.getElementById('sn'+i);
    const lbl=document.getElementById('sl'+i);
    if(i<n){num.className='step-num done';num.innerHTML='<i class="fas fa-check" style="font-size:.62rem"></i>';lbl.className='step-label done';}
    else if(i===n){num.className='step-num active';num.textContent=i;lbl.className='step-label active';}
    else{num.className='step-num idle';num.textContent=i;lbl.className='step-label';}
    if(i<3) document.getElementById('line'+i).classList.toggle('done',i<n);
  }
  for(let i=1;i<=4;i++) document.getElementById('step'+i).style.display=i===n?'block':'none';
  window.scrollTo({top:0,behavior:'smooth'});
}
function summaryHTML(){
  const p=PRICES[S.hostel][S.bedType],n=countNights(),total=p*S.beds*n;
  return `<div class="sum-row"><span class="lbl">Филиал</span><span class="val">${HOSTEL_NAMES[S.hostel]}</span></div>
  <div class="sum-row"><span class="lbl">Тип</span><span class="val">${BED_NAMES[S.bedType]}</span></div>
  <div class="sum-row"><span class="lbl">Заезд</span><span class="val">${dispDate(S.checkin)}</span></div>
  <div class="sum-row"><span class="lbl">Выезд</span><span class="val">${dispDate(S.checkout)}</span></div>
  <div class="sum-row"><span class="lbl">Ночей</span><span class="val">${n}</span></div>
  <div class="sum-row"><span class="lbl">Мест</span><span class="val">${S.beds}</span></div>
  <div class="sum-row"><span class="lbl">Цена за место/ночь</span><span class="val">${fmt(p)} сум</span></div>
  <div class="sum-row total"><span class="lbl">Итого</span><span class="val">${fmt(total)} сум</span></div>`;
}
function goStep1(){setStep(1);}
function goStep2(){if(!S.checkin||!S.checkout)return;document.getElementById('summary-box').innerHTML=summaryHTML();setStep(2);}
function validateStep2(){
  const ne=document.getElementById('guest-name'), pe=document.getElementById('guest-phone');
  ne.classList.remove('error');pe.classList.remove('error');
  let ok=true;
  if(ne.value.trim().length<2){ne.classList.add('error');ne.focus();ok=false;}
  if(pe.value.trim().length<7){pe.classList.add('error');if(ok)pe.focus();ok=false;}
  if(!ok)return;
  document.getElementById('summary-box2').innerHTML=summaryHTML();
  updatePayBtn(); setStep(3);
}
function selectPay(m,lbl){
  S.payMethod=m;
  document.querySelectorAll('.pay-opt').forEach(el=>el.classList.remove('selected'));
  if(lbl)lbl.classList.add('selected');
  updatePayBtn();
}
function updatePayBtn(){
  const map={payme:'Оплатить через Payme',click:'Оплатить через Click',cash:'Подтвердить бронь'};
  document.getElementById('btn-pay-label').textContent=map[S.payMethod];
  document.getElementById('btn-confirm-label').textContent=map[S.payMethod];
}

/* ── МОДАЛКА ── */
function openConfirmModal(){
  const pl={payme:'Payme',click:'Click',cash:'Наличные при заезде'};
  document.getElementById('modal-summary').innerHTML=summaryHTML()+
    `<div class="sum-row"><span class="lbl">Оплата</span><span class="val">${pl[S.payMethod]}</span></div>`;
  document.getElementById('confirm-modal').classList.add('open');
}
function closeConfirmModal(){document.getElementById('confirm-modal').classList.remove('open');}
document.addEventListener('keydown',e=>{if(e.key==='Escape')closeConfirmModal();});

/* ── ОТПРАВКА ── */
async function submitBooking(){
  const errBox=document.getElementById('err-box'),errTxt=document.getElementById('err-text');
  errBox.classList.remove('show'); closeConfirmModal();
  const btnPay=document.getElementById('btn-pay');
  btnPay.disabled=true; btnPay.innerHTML='<span class="spinner-sm"></span> Обработка…';
  const fd=new FormData();
  fd.append('action','create_booking');fd.append('hostel',S.hostel);fd.append('bed_type',S.bedType);
  fd.append('beds_count',S.beds);fd.append('checkin',S.checkin);fd.append('checkout',S.checkout);
  fd.append('guest_name',document.getElementById('guest-name').value.trim());
  fd.append('guest_phone',document.getElementById('guest-phone').value.trim());
  fd.append('guest_comment',document.getElementById('guest-comment').value.trim());
  fd.append('payment_method',S.payMethod);
  try{
    const r=await fetch(location.pathname,{method:'POST',headers:{'X-Requested-With':'XMLHttpRequest'},body:fd});
    const j=await r.json();
    if(!j.ok){errTxt.textContent=(j.errors||['Ошибка']).join(' • ');errBox.classList.add('show');btnPay.disabled=false;updatePayBtn();return;}
    if(S.payMethod==='payme'&&j.pay_url){window.location.href=j.pay_url;return;}
    if(S.payMethod==='click'&&j.click_params){
      const p=j.click_params,form=document.getElementById('click-form');
      form.action='<?= CLICK_CHECKOUT_URL ?>';
      document.getElementById('cf-service').value=p.service_id;document.getElementById('cf-merchant').value=p.merchant_id;
      document.getElementById('cf-amount').value=p.amount;document.getElementById('cf-txn').value=p.transaction_param;
      document.getElementById('cf-return').value=p.return_url; form.submit(); return;
    }
    // Оптимистичное обновление карты
    const d0=new Date(S.checkin+'T00:00:00'),d1=new Date(S.checkout+'T00:00:00');
    const hm=S.heatmaps[S.bedType]||{};
    for(const iso of Object.keys(hm)){
      const d=new Date(iso+'T00:00:00');
      if(d>=d0&&d<d1) hm[iso]=Math.max(0,hm[iso]-S.beds);
    }
    showSuccess(j.booking_id,S.payMethod==='cash');
  }catch(e){
    errTxt.textContent='Ошибка соединения. Попробуйте ещё раз.';
    errBox.classList.add('show');btnPay.disabled=false;updatePayBtn();
  }
}
function showSuccess(bid,isCash){
  document.getElementById('success-bid').textContent='Заказ #'+bid;
  document.getElementById('success-title').textContent=isCash?'Бронирование принято!':'Оплата прошла!';
  document.getElementById('success-text').textContent=isCash
    ?'Мы свяжемся с вами по телефону. Оплата при заселении.'
    :'Бронирование подтверждено и оплачено. Ждём вас!';
  for(let i=1;i<=3;i++) document.getElementById('step'+i).style.display='none';
  document.getElementById('step4').style.display='block';
  document.getElementById('stepper').style.display='none';
  window.scrollTo({top:0,behavior:'smooth'});
}

/* ── МАСКА ТЕЛЕФОНА ── */
(function(){
  const ph=document.getElementById('guest-phone'); if(!ph)return;
  ph.addEventListener('focus',()=>{if(!ph.value)ph.value='+998 ';});
  ph.addEventListener('input',()=>{
    let v=ph.value.replace(/[^\d\+]/g,'');
    if(v.startsWith('+998')){
      const d=v.slice(4).replace(/\D/g,'');
      let out='+998';
      if(d.length>0)out+=' '+d.slice(0,2);
      if(d.length>2)out+=' '+d.slice(2,5);
      if(d.length>5)out+=' '+d.slice(5,7);
      if(d.length>7)out+=' '+d.slice(7,9);
      ph.value=out;
    }
  });
})();

/* ── ИНИЦИАЛИЗАЦИЯ ── */
updatePriceLabels();
renderCalendars();
loadAllHeatmaps(S.hostel);
</script>
</body>
</html>