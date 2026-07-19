# Khandelwal & Sons - product image downloader
# Downloads product pack shots (Amazon CDN) and stock photos (Unsplash) into images/
$ErrorActionPreference = 'Continue'
$dir = Join-Path $PSScriptRoot 'images'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'

$images = @{
  # --- Amul ---
  'amul-butter.jpg'          = 'https://m.media-amazon.com/images/I/61vr7r8qqsL._SL500_.jpg'
  'amul-butter-unsalted.jpg' = 'https://m.media-amazon.com/images/I/51X+rByJs0L._SL500_.jpg'
  'amul-ghee.jpg'            = 'https://m.media-amazon.com/images/I/81SrMc+3fkL._SL500_.jpg'
  'amul-cheese-block.jpg'    = 'https://m.media-amazon.com/images/I/51WYEwnaOBL._SL500_.jpg'
  'amul-cheese-slices.jpg'   = 'https://m.media-amazon.com/images/I/71vM-znOuDL._SL500_.jpg'
  'amul-dahi.jpg'            = 'https://m.media-amazon.com/images/I/71FXhkGG4rL._SL500_.jpg'
  'amul-paneer.jpg'          = 'https://m.media-amazon.com/images/I/81XmZiUfm5L._SL500_.jpg'
  'amul-cream.jpg'           = 'https://m.media-amazon.com/images/I/71xrLO3FK5L._SL500_.jpg'
  'amul-lassi.jpg'           = 'https://m.media-amazon.com/images/I/41uQT4PS8ML._SL500_.jpg'
  'amul-kool.jpg'            = 'https://m.media-amazon.com/images/I/719m061INZL._SL500_.jpg'
  'amul-kool-cafe.jpg'       = 'https://m.media-amazon.com/images/I/71tzaJn-DfL._SL500_.jpg'
  'amul-gold-milk.jpg'       = 'https://m.media-amazon.com/images/I/41viNPJBqPL._SL500_.jpg'
  'amul-buttermilk.jpg'      = 'https://m.media-amazon.com/images/I/71WnRjJeV0L._SL500_.jpg'
  'amul-chaas.jpg'           = 'https://m.media-amazon.com/images/I/71Dqp38hOQL._SL500_.jpg'
  'amul-crackle.jpg'         = 'https://m.media-amazon.com/images/I/81vu2MfH88L._SL500_.jpg'
  'mozzarella-diced.jpg'     = 'https://m.media-amazon.com/images/I/81GHKnAhPsL._SL500_.jpg'
  'mozzarella-pizza.jpg'     = 'https://m.media-amazon.com/images/I/71eanq1nkRL._SL500_.jpg'
  # --- Other brands ---
  'cdm-roast-almond.jpg'     = 'https://m.media-amazon.com/images/I/61N62PkTi3L._SL500_.jpg'
  'gowardhan-ghee.jpg'       = 'https://m.media-amazon.com/images/I/71akv5ZMODL._SL500_.jpg'
  'gowardhan-cheese.jpg'     = 'https://m.media-amazon.com/images/I/71a6RASjuhL._SL500_.jpg'
  'nutralite.jpg'            = 'https://m.media-amazon.com/images/I/81XOcVyu+4L._SL500_.jpg'
  'parle-g.jpg'              = 'https://m.media-amazon.com/images/I/61kZskdmJzL._SL500_.jpg'
  'melody.jpg'               = 'https://m.media-amazon.com/images/I/810Nh5SXT-L._SL500_.jpg'
  'cheeselings.jpg'          = 'https://m.media-amazon.com/images/I/61y7Acw1fKL._SL500_.jpg'
  'mccain-fries.jpg'         = 'https://m.media-amazon.com/images/I/81BoSooNKjL._SL500_.jpg'
  'hyfun-fries.jpg'          = 'https://m.media-amazon.com/images/I/81V057sSEDL._SL500_.jpg'
  'hungritos-fries.jpg'      = 'https://m.media-amazon.com/images/I/81rq6ntOeVL._SL500_.jpg'
  'hyfun-pizza.jpg'          = 'https://m.media-amazon.com/images/I/91nlyBDhGML._SL500_.jpg'
  'momos.jpg'                = 'https://m.media-amazon.com/images/I/71OjNPQqITL._SL500_.jpg'
  'burger-patty.jpg'         = 'https://m.media-amazon.com/images/I/81q6FAqIfvL._SL500_.jpg'
  'potato-wedges.jpg'        = 'https://m.media-amazon.com/images/I/81prLU7zZeL._SL500_.jpg'
  'corn-nuggets.jpg'         = 'https://m.media-amazon.com/images/I/81V4ld8XVUL._SL500_.jpg'
  'sweet-corn.jpg'           = 'https://m.media-amazon.com/images/I/51+-iaXElrL._SL500_.jpg'
  'aloo-paratha.jpg'         = 'https://m.media-amazon.com/images/I/7134egDUOHL._SL500_.jpg'
  'lachha-paratha.jpg'       = 'https://m.media-amazon.com/images/I/61KvKV6276L._SL500_.jpg'
  'mascarpone.jpg'           = 'https://m.media-amazon.com/images/I/5131yp1av6L._SL500_.jpg'
  'cheese-sauce.jpg'         = 'https://m.media-amazon.com/images/I/61pHsTQopCL._SL500_.jpg'
  'richs-cream.jpg'          = 'https://m.media-amazon.com/images/I/51LrZaRfohL._SL500_.jpg'
  'whipping-cream.jpg'       = 'https://m.media-amazon.com/images/I/519btHUUJRL._SL500_.jpg'
  'mathura-peda.jpg'         = 'https://m.media-amazon.com/images/I/81o6tBbz7WL._SL500_.jpg'
  'halwa.jpg'                = 'https://m.media-amazon.com/images/I/61KnbtcsAzL._SL500_.jpg'
  'panchmeva.jpg'            = 'https://m.media-amazon.com/images/I/61uYWKKjweL._SL500_.jpg'
  'banana-chips.jpg'         = 'https://m.media-amazon.com/images/I/41-YYaI8neL._SL500_.jpg'
  'dark-compound.jpg'        = 'https://m.media-amazon.com/images/I/615rhqvbiHL._SL500_.jpg'
  'choco-strands.jpg'        = 'https://m.media-amazon.com/images/I/71T6BKCVv7L._SL500_.jpg'
  'mayonnaise.jpg'           = 'https://m.media-amazon.com/images/I/81Ypd27PHdL._SL500_.jpg'
  'namkeen-mix.jpg'          = 'https://m.media-amazon.com/images/I/71jHFh6dYzL._SL500_.jpg'
  'buffalo-milk.jpg'         = 'https://m.media-amazon.com/images/I/61J-vLQG4kL._SL500_.jpg'
  'milk-pouch.jpg'           = 'https://m.media-amazon.com/images/I/51b6XWAjywL._SL500_.jpg'
  'toned-milk-carton.jpg'    = 'https://m.media-amazon.com/images/I/71TSXjY7SZL._SL500_.jpg'
  'curd-cup.jpg'             = 'https://m.media-amazon.com/images/I/61OIsXi+tXL._SL500_.jpg'
  'bread.jpg'                = 'https://m.media-amazon.com/images/I/51X0vuTmynL._SL500_.jpg'
  # --- Stock (Unsplash) for unbranded / store-label items ---
  'butter-generic.jpg'       = 'https://images.unsplash.com/photo-1603596310923-dbb12732f9c7?auto=format&fit=crop&w=700&q=80'
  'cheese-generic.jpg'       = 'https://images.unsplash.com/photo-1631379578550-7038263db699?auto=format&fit=crop&w=700&q=80'
  'fries-generic.jpg'        = 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=700&q=80'
}

$fail = @()
foreach ($kv in $images.GetEnumerator()) {
  $out = Join-Path $dir $kv.Key
  try {
    Invoke-WebRequest -Uri $kv.Value -OutFile $out -Headers @{ 'User-Agent' = $ua } -TimeoutSec 30
    Write-Host ("OK   {0}  {1:N0} bytes" -f $kv.Key, (Get-Item $out).Length)
  } catch {
    $fail += $kv.Key
    Write-Host ("FAIL {0}  {1}" -f $kv.Key, $_.Exception.Message)
  }
}
Write-Host ("`nDone. {0}/{1} downloaded, {2} failed." -f ($images.Count - $fail.Count), $images.Count, $fail.Count)
if ($fail.Count) { Write-Host ("Failed: " + ($fail -join ', ')) }
