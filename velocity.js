runAfterLoad(function(){

doVelocity = function(pixel) {
    if (!((pixel.vx || pixel.vy) && elements[pixel.element].movable)) return;

    var stepsX = Math.abs(pixel.vx);
    var stepsY = Math.abs(pixel.vy);
    var steps = Math.max(stepsX, stepsY);

    if (steps === 0) return;

    var signX = Math.sign(pixel.vx);
    var signY = Math.sign(pixel.vy);

    var errX = 0, errY = 0;

    for (var i = 0; i < steps; i++) {
        errX += stepsX;
        errY += stepsY;

        var moveX = errX >= steps;
        var moveY = errY >= steps;
        if (moveX) errX -= steps;
        if (moveY) errY -= steps;
        if (!moveX && !moveY) continue;

        var x = pixel.x + (moveX ? signX : 0);
        var y = pixel.y + (moveY ? signY : 0);

        if (tryMove(pixel, x, y)) continue;

        // Blocked: transfer the pixel's *remaining* velocity to whatever
        // it hit, exactly once, then stop this pixel's motion this frame.
        if (!isEmpty(x, y, true)) {
            var newPixel = pixelMap[x][y];
            if (elements[newPixel.element].movable) {
                var remainingX = signX * Math.max(0, stepsX - i);
                var remainingY = signY * Math.max(0, stepsY - i);
                if (moveX) newPixel.vx = (newPixel.vx || 0) + remainingX;
                if (moveY) newPixel.vy = (newPixel.vy || 0) + remainingY;
                if (elements[pixel.element].breakInto &&
                    Math.random() < elements[pixel.element].breakIntoChance) {
                    changePixel(pixel, elements[pixel.element].breakInto);
                }
            }
        }
        pixel.vx = 0;
        pixel.vy = 0;
        break;
    }
}

runPerPixel(doVelocity);

})

function pickFire(fire) {
    return Array.isArray(fire) ? fire[Math.floor(Math.random() * fire.length)] : fire;
}

explodeAt = function(x, y, radius, fire = "fire") {
    if (fire.indexOf && fire.indexOf(",") !== -1) {
        fire = fire.split(",");
    }
    var coords = circleCoords(x, y, radius);
    var power = radius / 10;

    for (var i = 0; i < coords.length; i++) {
        var dx = coords[i].x - x;
        var dy = coords[i].y - y;
        var dist = Math.sqrt(dx * dx + dy * dy);

        // damage falls off linearly from center (1) to edge (0)
        var damage = 1 - (dist / radius) - (Math.random() * 0.15);
        if (damage < 0) damage = 0;
        damage *= power;

        if (isEmpty(coords[i].x, coords[i].y)) {
            if (damage < 0.02) { /* nothing */ }
            else if (damage < 0.2) {
                createPixel("smoke", coords[i].x, coords[i].y);
            } else {
                createPixel(pickFire(fire), coords[i].x, coords[i].y);
            }
            continue;
        }

        if (outOfBounds(coords[i].x, coords[i].y)) continue;

        var pixel = pixelMap[coords[i].x][coords[i].y];
        var info = elements[pixel.element];

        if (info.hardness) {
            if (info.hardness < 1) {
                damage *= Math.pow((1 - info.hardness), info.hardness);
            } else {
                damage = 0;
            }
        }

        if (damage > 0.9) {
            changePixel(pixel, pickFire(fire));
            continue;
        } else if (damage > 0.25) {
            if (info.breakInto !== undefined) {
                breakPixel(pixel);
            } else {
                if (info.onBreak !== undefined) info.onBreak(pixel);
                changePixel(pixel, pickFire(fire));
            }
            continue;
        }

        if (damage > 0.75 && info.burn) {
            pixel.burning = true;
            pixel.burnStart = pixelTicks;
        }

        pixel.temp += damage * radius * power;
        pixelTempCheck(pixel);

        if (!info.excludeRandom) {
            var angle = Math.atan2(dy, dx);
            var kick = damage * power * 3;
            pixel.vx = Math.round((pixel.vx | 0) + Math.cos(angle) * kick);
            pixel.vy = Math.round((pixel.vy | 0) + Math.sin(angle) * kick);
        }
    }
}
