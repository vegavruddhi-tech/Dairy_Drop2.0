Add-Type -AssemblyName System.Drawing

$srcPath = "e:\Dairy_Drop2.0\next-app\public\image.png"
$src = [System.Drawing.Image]::FromFile($srcPath)
Write-Output ("Source size: " + $src.Width + "x" + $src.Height)

function Create-Icon {
    param(
        [string]$outputPath,
        [int]$size,
        [double]$scaleFactor, # proportion of $size to fit the image in
        [System.Drawing.Color]$bgColor
    )

    $bmp = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
    $g = [System.Drawing.Graphics]::FromImage($bmp)
    
    $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $g.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality

    $g.Clear($bgColor)

    # Calculate target box
    $maxTargetW = $size * $scaleFactor
    $maxTargetH = $size * $scaleFactor

    $aspect = $src.Width / $src.Height
    if ($aspect -gt 1) {
        $drawW = $maxTargetW
        $drawH = $maxTargetW / $aspect
    } else {
        $drawH = $maxTargetH
        $drawW = $maxTargetH * $aspect
    }

    $destX = ($size - $drawW) / 2
    $destY = ($size - $drawH) / 2

    $destRect = New-Object System.Drawing.RectangleF([float]$destX, [float]$destY, [float]$drawW, [float]$drawH)
    $srcRect = New-Object System.Drawing.RectangleF(0, 0, [float]$src.Width, [float]$src.Height)

    $g.DrawImage($src, $destRect, $srcRect, [System.Drawing.GraphicsUnit]::Pixel)

    $bmp.Save($outputPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $g.Dispose()
    $bmp.Dispose()
    Write-Output ("Saved " + $outputPath)
}

# 1. Standard Icons (purpose: any) - transparent background, comfortably padded (80% box)
Create-Icon -outputPath "e:\Dairy_Drop2.0\next-app\public\icon-512.png" -size 512 -scaleFactor 0.82 -bgColor ([System.Drawing.Color]::FromArgb(0, 255, 255, 255))
Create-Icon -outputPath "e:\Dairy_Drop2.0\next-app\public\icon-192.png" -size 192 -scaleFactor 0.82 -bgColor ([System.Drawing.Color]::FromArgb(0, 255, 255, 255))

# 2. Maskable Icons (purpose: maskable) - white background, fitted strictly inside the 70% safe zone circle so Android squircle mask NEVER crops any text or edges!
Create-Icon -outputPath "e:\Dairy_Drop2.0\next-app\public\icon-maskable-512.png" -size 512 -scaleFactor 0.70 -bgColor ([System.Drawing.Color]::White)
Create-Icon -outputPath "e:\Dairy_Drop2.0\next-app\public\icon-maskable-192.png" -size 192 -scaleFactor 0.70 -bgColor ([System.Drawing.Color]::White)

# 3. Apple Touch Icon (180x180) - white bg with 75% scale
Create-Icon -outputPath "e:\Dairy_Drop2.0\next-app\public\apple-touch-icon.png" -size 180 -scaleFactor 0.75 -bgColor ([System.Drawing.Color]::White)

# 4. Also create a square version of image.png or update image-square.png if needed
Create-Icon -outputPath "e:\Dairy_Drop2.0\next-app\public\icon-square.png" -size 512 -scaleFactor 0.85 -bgColor ([System.Drawing.Color]::White)

$src.Dispose()
Write-Output "Done generating all icons!"
