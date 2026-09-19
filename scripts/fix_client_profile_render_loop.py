"""Make the inherited profile adapter's DOM installation idempotent.

The profile observer watches childList in the whole anagrafica section. Writing
caption.textContent on every callback creates a fresh childList mutation even
when the text is identical, starving timers, painting and keyboard input at login.
Only presentation writes are changed; save/authentication code is left untouched.
"""
VERSION = '20260919-profile-loop1'
MARKER = 'OPTYKER_PROFILE_RENDER_LOOP_FIXED_20260919'


def fix_profile(source):
    if MARKER in source:
        return source
    pairs = [
        ("if (place) {\n      var placeWrap = place.closest('label');",
         "if (place && !document.getElementById('optykerBirthCountryMainInput')) {\n      var placeWrap = place.closest('label');"),
        ("if (caption) caption.textContent = 'Paese di nascita';",
         "if (caption && caption.textContent !== 'Paese di nascita') caption.textContent = 'Paese di nascita';"),
        ("placeWrap.className = 'clientProfileField optykerBirthPlaceField';",
         "if (placeWrap.className !== 'clientProfileField optykerBirthPlaceField') placeWrap.className = 'clientProfileField optykerBirthPlaceField';"),
        ("placeWrap.dataset.optykerBirthPlaceMain = '1';",
         "if (placeWrap.dataset.optykerBirthPlaceMain !== '1') placeWrap.dataset.optykerBirthPlaceMain = '1';"),
        ("placeWrap.hidden = false;", "if (placeWrap.hidden) placeWrap.hidden = false;"),
        ("place.placeholder = 'Paese di nascita';",
         "if (place.placeholder !== 'Paese di nascita') place.placeholder = 'Paese di nascita';"),
        ("place.autocomplete = 'off';",
         "if (place.autocomplete !== 'off') place.autocomplete = 'off';"),
    ]
    for old, new in pairs:
        if source.count(old) != 1:
            raise ValueError('Profile loop fix: unexpected source anchor: ' + old)
        source = source.replace(old, new, 1)
    return '/* ' + MARKER + ' · ' + VERSION + ' */\n' + source
