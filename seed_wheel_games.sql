-- =====================================================
-- Yaoshi Spin-Wheel Games – Full Seed
-- 7 games × 40+ questions each
-- Generated automatically – safe to re-run (ON CONFLICT UPDATE)
-- =====================================================

-- ────────────────────────────────────────────
-- GAME: פגישה ראשונה (first-date-spin)
-- ────────────────────────────────────────────
DO $$
DECLARE
  g_id uuid;
BEGIN

  INSERT INTO public.games
    (name_he, name_en, description_he, description_en, slug,
     is_active, bg_type, bg_value, player_mode)
  VALUES (
    'פגישה ראשונה',
    'First Date Wheel',
    'גלגל המשחק המושלם לדייט ראשון - שוברי קרח, סקרנות, אתגרים כיפיים וגילויים מפתיעים.',
    'The perfect wheel game for a first date - ice breakers, curiosity, fun dares and surprising discoveries.',
    'first-date-spin',
    true, 'color', '#1a0a2e', false
  )
  ON CONFLICT (slug) DO UPDATE SET
    name_he = 'פגישה ראשונה',
    name_en = 'First Date Wheel',
    description_he = 'גלגל המשחק המושלם לדייט ראשון - שוברי קרח, סקרנות, אתגרים כיפיים וגילויים מפתיעים.',
    description_en = 'The perfect wheel game for a first date - ice breakers, curiosity, fun dares and surprising discoveries.',
    bg_type = 'color',
    bg_value = '#1a0a2e'
  RETURNING id INTO g_id;

  INSERT INTO public.wheel_configs
    (game_id, slices, pointer_color, inner_circle,
     inner_circle_color, inner_circle_border_color, border_color,
     divider_color, divider_enabled, divider_width,
     marker_config, category_colors, player_config)
  VALUES (
    g_id,
    '[{"id": "slice-icebreaker-0", "label_he": "🧊 שוברי קרח", "label_en": "🧊 Ice Breakers", "color": "#FF6B9D", "question_type": "icebreaker"}, {"id": "slice-curiosity-0", "label_he": "💭 מי אתה?", "label_en": "💭 Who Are You?", "color": "#FF8E53", "question_type": "curiosity"}, {"id": "slice-dare_fun-0", "label_he": "😄 אתגר כיפי", "label_en": "😄 Fun Dare", "color": "#C77DFF", "question_type": "dare_fun"}, {"id": "slice-dreamwish-0", "label_he": "✨ חלומות", "label_en": "✨ Dreams", "color": "#FFD700", "question_type": "dreamwish"}, {"id": "slice-wouldyou-0", "label_he": "🎲 מה תעדיף?", "label_en": "🎲 Would You Rather?", "color": "#4FC3F7", "question_type": "wouldyou"}, {"id": "slice-icebreaker-1", "label_he": "🧊 שוברי קרח", "label_en": "🧊 Ice Breakers", "color": "#FF6B9D", "question_type": "icebreaker"}, {"id": "slice-curiosity-1", "label_he": "💭 מי אתה?", "label_en": "💭 Who Are You?", "color": "#FF8E53", "question_type": "curiosity"}, {"id": "slice-dare_fun-1", "label_he": "😄 אתגר כיפי", "label_en": "😄 Fun Dare", "color": "#C77DFF", "question_type": "dare_fun"}, {"id": "slice-dreamwish-1", "label_he": "✨ חלומות", "label_en": "✨ Dreams", "color": "#FFD700", "question_type": "dreamwish"}, {"id": "slice-wouldyou-1", "label_he": "🎲 מה תעדיף?", "label_en": "🎲 Would You Rather?", "color": "#4FC3F7", "question_type": "wouldyou"}]'::jsonb,
    '#ffffff', true, '#1a1a2e', '#ffffff', '#ffffff',
    '#ffffff', true, 2,
    '{"marker_type": "none", "marker_color": "#ffffff", "marker_size": 8, "marker_count": 0, "marker_position": 0}'::jsonb,
    '{"icebreaker": "#FF6B9D", "curiosity": "#FF8E53", "dare_fun": "#C77DFF", "dreamwish": "#FFD700", "wouldyou": "#4FC3F7"}'::jsonb,
    '{"desired_total_slices": 10, "categories": [{"id": "cat-icebreaker", "key": "icebreaker", "label_he": "🧊 שוברי קרח", "label_en": "🧊 Ice Breakers", "color": "#FF6B9D"}, {"id": "cat-curiosity", "key": "curiosity", "label_he": "💭 מי אתה?", "label_en": "💭 Who Are You?", "color": "#FF8E53"}, {"id": "cat-dare_fun", "key": "dare_fun", "label_he": "😄 אתגר כיפי", "label_en": "😄 Fun Dare", "color": "#C77DFF"}, {"id": "cat-dreamwish", "key": "dreamwish", "label_he": "✨ חלומות", "label_en": "✨ Dreams", "color": "#FFD700"}, {"id": "cat-wouldyou", "key": "wouldyou", "label_he": "🎲 מה תעדיף?", "label_en": "🎲 Would You Rather?", "color": "#4FC3F7"}], "player_repetitions": 8}'::jsonb
  )
  ON CONFLICT (game_id) DO UPDATE SET
    slices = EXCLUDED.slices,
    category_colors = EXCLUDED.category_colors,
    player_config = EXCLUDED.player_config;

  -- Delete existing questions for this game (clean re-seed)
  DELETE FROM public.questions WHERE game_id = g_id;

  INSERT INTO public.questions
    (game_id, type, level, text_he, text_en, is_active)
  VALUES
    (g_id, 'icebreaker', 'light', 'ספר משהו מצחיק שקרה לך השבוע - קטן ככל שיהיה', 'Tell something funny that happened to you this week - however small', true),
    (g_id, 'icebreaker', 'light', 'מה הדבר הכי מוזר שאכלת בחיים שלך?', 'What''s the strangest thing you''ve ever eaten in your life?', true),
    (g_id, 'icebreaker', 'light', 'שיר אחד שאתה יודע בעל פה - שר 10 שניות עכשיו', 'One song you know by heart - sing 10 seconds right now', true),
    (g_id, 'icebreaker', 'light', 'מה הכינוי שהיה לך בילדות ומאיפה הוא הגיע?', 'What nickname did you have as a child and where did it come from?', true),
    (g_id, 'icebreaker', 'light', 'גלה הרגל מוזר אחד שלך שרוב האנשים לא יודעים עליו', 'Reveal one weird habit of yours that most people don''t know', true),
    (g_id, 'icebreaker', 'light', 'מה הסרט שראית הכי הרבה פעמים בחיים?', 'What movie have you watched the most times in your life?', true),
    (g_id, 'icebreaker', 'light', 'ספר עובדה מפתיעה אחת על עצמך שהאחר בטח לא מנחש', 'Tell one surprising fact about yourself the other can''t guess', true),
    (g_id, 'icebreaker', 'light', 'עשה את הקול החייתי הכי מדויק שאתה יכול - 5 שניות', 'Make the most accurate animal sound you can - 5 seconds', true),
    (g_id, 'icebreaker', 'light', 'מה הייתה ה-phase האומנותית הכי מביכה שלך בגיל 14?', 'What was your most embarrassing artistic phase at age 14?', true),
    (g_id, 'curiosity', 'flirty', 'מה הדבר הראשון שמשך אותך אליי כשנפגשנו?', 'What first attracted you to me when we met?', true),
    (g_id, 'curiosity', 'flirty', 'תאר את הדייט האידיאלי שלך - פרטים קטנים ספציפיים!', 'Describe your ideal date - specific small details!', true),
    (g_id, 'curiosity', 'flirty', 'מה הדבר שהכי הפתיע אותך אצלי עד כה?', 'What surprised you most about me so far?', true),
    (g_id, 'curiosity', 'flirty', 'מה הרגשת כשראית אותי בפעם הראשונה? תהיה כנה', 'What did you feel when you saw me for the first time? Be honest', true),
    (g_id, 'curiosity', 'flirty', 'מה חשוב לך יותר ביחסים - פיזי או רגשי? למה?', 'What matters more to you in a relationship - physical or emotional? Why?', true),
    (g_id, 'curiosity', 'flirty', 'מה מביך אותך מהר ומה גורם לך להיפתח לאדם?', 'What embarrasses you quickly and what makes you open up to someone?', true),
    (g_id, 'curiosity', 'flirty', 'מהי החוויה האדרנלינית הכי גדולה שעברת? רצית לחזור?', 'What''s the biggest adrenaline experience you''ve had? Did you want to repeat it?', true),
    (g_id, 'curiosity', 'flirty', 'מה בן/בת הזוג האידיאלי שלך חייב/ת שיהיה לו/לה? דבר אחד', 'What must your ideal partner have? One thing only', true),
    (g_id, 'curiosity', 'flirty', 'ספר לי על רגע שחשבת שמישהו מיוחד נכנס לחיים שלך', 'Tell me about a moment you thought someone special was entering your life', true),
    (g_id, 'dare_fun', 'light', 'שלח הודעת קול לחבר עם בדיחה שאתה ממציא ברגע זה', 'Send a voice message to a friend with a joke you invent right now', true),
    (g_id, 'dare_fun', 'light', 'עשה ריקוד של 15 שניות לשיר שהצד השני בוחר עבורך', 'Do a 15-second dance to a song the other person picks for you', true),
    (g_id, 'dare_fun', 'light', 'חקה את הצד השני - הליכה, מחווה, ביטוי - בדיוק רב ככל שתוכל', 'Imitate the other person - walk, gesture, expression - as accurately as you can', true),
    (g_id, 'dare_fun', 'light', 'בלי להשתמש בידיים - אכול משהו מהשולחן', 'Without using your hands - eat something from the table', true),
    (g_id, 'dare_fun', 'light', 'תאר את הצד השני כסוג של פיצה - מה הרכיבים?', 'Describe the other person as a type of pizza - what are the toppings?', true),
    (g_id, 'dare_fun', 'light', 'ספר בדיחה שאתה בטוח 100% שהאחר ישחק עליה', 'Tell a joke you''re 100% sure the other will laugh at', true),
    (g_id, 'dare_fun', 'light', 'שלח אמוג''י שמסכם את הדייט הזה עד עכשיו - ואסביר למה בחרת', 'Send an emoji that sums up this date so far - and explain why you chose it', true),
    (g_id, 'dare_fun', 'light', 'עשה מחמאה לצד השני - בלי להשתמש במילה ''יפה'' או ''נחמד''', 'Give the other person a compliment - without using the word ''beautiful'' or ''nice''', true),
    (g_id, 'dreamwish', 'deep', 'מה דבר אחד שאתה רוצה לחוות לפחות פעם אחת בחיים?', 'What''s one thing you want to experience at least once in life?', true),
    (g_id, 'dreamwish', 'deep', 'אם כסף לא היה גורם - מה היית עושה עם הזמן שלך?', 'If money wasn''t a factor - what would you do with your time?', true),
    (g_id, 'dreamwish', 'deep', 'מה הדבר שאתה הכי גאה בו - שאחרים לא בהכרח יודעים?', 'What are you most proud of - that others may not necessarily know?', true),
    (g_id, 'dreamwish', 'deep', 'לאיזה מקום בעולם תרצה לגור שנה שלמה ולמה?', 'Which place in the world would you want to live for a whole year and why?', true),
    (g_id, 'dreamwish', 'deep', 'מה חלום שעדיין לא הגשמת אבל עדיין לא ויתרת עליו?', 'What''s a dream you haven''t fulfilled yet but haven''t given up on?', true),
    (g_id, 'dreamwish', 'deep', 'תאר את הבוקר המושלם שלך בחיי החלום - כל פרט', 'Describe your perfect morning in your dream life - every detail', true),
    (g_id, 'dreamwish', 'deep', 'מה הדבר שפחדת ממנו ועשית בכל זאת - ומה הרגשת אחרי?', 'What''s something you were afraid of and did anyway - and how did you feel after?', true),
    (g_id, 'dreamwish', 'deep', 'אם תוכל ללמד דבר אחד לכל בני האדם - מה זה יהיה?', 'If you could teach one thing to all humanity - what would it be?', true),
    (g_id, 'wouldyou', 'flirty', 'יציאה לים בלילה עם מוזיקה בשקט, או טיול הרים עם שתיקה מלאה?', 'A late-night beach with quiet music, or a mountain hike in complete silence?', true),
    (g_id, 'wouldyou', 'flirty', 'חיבוק ארוך בלי מילים, או שיחה עמוקה עד שעות הלילה?', 'A long hug without words, or a deep conversation until late at night?', true),
    (g_id, 'wouldyou', 'flirty', 'לדעת מה הצד השני חושב עליך כרגע, או לשמור על המסתורין?', 'Know what the other person thinks of you right now, or keep the mystery?', true),
    (g_id, 'wouldyou', 'flirty', 'לקבל פרח אחד בהפתעה, או זר גדול בתאריך ידוע?', 'Receive one surprise flower, or a big bouquet on a known date?', true),
    (g_id, 'wouldyou', 'flirty', 'לצאת לדייט מתוכנן לפרטים הקטנים, או הרפתקה ספונטנית לגמרי?', 'Go on a meticulously planned date, or a completely spontaneous adventure?', true),
    (g_id, 'wouldyou', 'flirty', 'לשמוע ''אני אוהב/ת אותך'' פעם אחת מכל הלב, או בכל יום בקצרה?', 'Hear ''I love you'' once with full heart, or hear it briefly every day?', true),
    (g_id, 'wouldyou', 'flirty', 'לבלות שבוע בלי טלפון עם אדם מיוחד, או שבוע עם הטלפון בגפך?', 'Spend a week without phone with someone special, or a week alone with your phone?', true),
    (g_id, 'wouldyou', 'flirty', 'שיבנה קשר אט אט ובטוח, או כימיה סוחפת מהרגע הראשון?', 'Build a relationship slowly and securely, or overwhelming chemistry from the first moment?', true);

END;
$$;

-- ────────────────────────────────────────────
-- GAME: זוגיות בלב (couple-heart-spin)
-- ────────────────────────────────────────────
DO $$
DECLARE
  g_id uuid;
BEGIN

  INSERT INTO public.games
    (name_he, name_en, description_he, description_en, slug,
     is_active, bg_type, bg_value, player_mode)
  VALUES (
    'זוגיות בלב',
    'Couple Heart Wheel',
    'לזוגות שרוצים להתחבר עמוק יותר - הוקרה, זיכרונות משותפים, שיחות עומק ואתגרי זוג.',
    'For couples who want to connect deeper - appreciation, shared memories, deep talks and couple dares.',
    'couple-heart-spin',
    true, 'color', '#1a0010', false
  )
  ON CONFLICT (slug) DO UPDATE SET
    name_he = 'זוגיות בלב',
    name_en = 'Couple Heart Wheel',
    description_he = 'לזוגות שרוצים להתחבר עמוק יותר - הוקרה, זיכרונות משותפים, שיחות עומק ואתגרי זוג.',
    description_en = 'For couples who want to connect deeper - appreciation, shared memories, deep talks and couple dares.',
    bg_type = 'color',
    bg_value = '#1a0010'
  RETURNING id INTO g_id;

  INSERT INTO public.wheel_configs
    (game_id, slices, pointer_color, inner_circle,
     inner_circle_color, inner_circle_border_color, border_color,
     divider_color, divider_enabled, divider_width,
     marker_config, category_colors, player_config)
  VALUES (
    g_id,
    '[{"id": "slice-appreciation-0", "label_he": "💕 הוקרה", "label_en": "💕 Appreciation", "color": "#E91E63", "question_type": "appreciation"}, {"id": "slice-deep_connect-0", "label_he": "🔍 עומק", "label_en": "🔍 Deep Connection", "color": "#9C27B0", "question_type": "deep_connect"}, {"id": "slice-memory-0", "label_he": "📸 זיכרון", "label_en": "📸 Memory", "color": "#F44336", "question_type": "memory"}, {"id": "slice-couple_dare-0", "label_he": "🎯 אתגר זוגי", "label_en": "🎯 Couple Dare", "color": "#FF5722", "question_type": "couple_dare"}, {"id": "slice-future-0", "label_he": "🌟 עתיד ביחד", "label_en": "🌟 Future Together", "color": "#FF9800", "question_type": "future"}, {"id": "slice-appreciation-1", "label_he": "💕 הוקרה", "label_en": "💕 Appreciation", "color": "#E91E63", "question_type": "appreciation"}, {"id": "slice-deep_connect-1", "label_he": "🔍 עומק", "label_en": "🔍 Deep Connection", "color": "#9C27B0", "question_type": "deep_connect"}, {"id": "slice-memory-1", "label_he": "📸 זיכרון", "label_en": "📸 Memory", "color": "#F44336", "question_type": "memory"}, {"id": "slice-couple_dare-1", "label_he": "🎯 אתגר זוגי", "label_en": "🎯 Couple Dare", "color": "#FF5722", "question_type": "couple_dare"}, {"id": "slice-future-1", "label_he": "🌟 עתיד ביחד", "label_en": "🌟 Future Together", "color": "#FF9800", "question_type": "future"}]'::jsonb,
    '#ffffff', true, '#1a1a2e', '#ffffff', '#ffffff',
    '#ffffff', true, 2,
    '{"marker_type": "none", "marker_color": "#ffffff", "marker_size": 8, "marker_count": 0, "marker_position": 0}'::jsonb,
    '{"appreciation": "#E91E63", "deep_connect": "#9C27B0", "memory": "#F44336", "couple_dare": "#FF5722", "future": "#FF9800"}'::jsonb,
    '{"desired_total_slices": 10, "categories": [{"id": "cat-appreciation", "key": "appreciation", "label_he": "💕 הוקרה", "label_en": "💕 Appreciation", "color": "#E91E63"}, {"id": "cat-deep_connect", "key": "deep_connect", "label_he": "🔍 עומק", "label_en": "🔍 Deep Connection", "color": "#9C27B0"}, {"id": "cat-memory", "key": "memory", "label_he": "📸 זיכרון", "label_en": "📸 Memory", "color": "#F44336"}, {"id": "cat-couple_dare", "key": "couple_dare", "label_he": "🎯 אתגר זוגי", "label_en": "🎯 Couple Dare", "color": "#FF5722"}, {"id": "cat-future", "key": "future", "label_he": "🌟 עתיד ביחד", "label_en": "🌟 Future Together", "color": "#FF9800"}], "player_repetitions": 8}'::jsonb
  )
  ON CONFLICT (game_id) DO UPDATE SET
    slices = EXCLUDED.slices,
    category_colors = EXCLUDED.category_colors,
    player_config = EXCLUDED.player_config;

  -- Delete existing questions for this game (clean re-seed)
  DELETE FROM public.questions WHERE game_id = g_id;

  INSERT INTO public.questions
    (game_id, type, level, text_he, text_en, is_active)
  VALUES
    (g_id, 'appreciation', 'light', 'אמור לבן/בת זוגך דבר אחד שהוא/היא עושה שגורם לך להרגיש בטוח/ה', 'Tell your partner one thing they do that makes you feel safe', true),
    (g_id, 'appreciation', 'light', 'מה הדבר שהכי אהבת בשבוע האחרון שהם עשו?', 'What''s one thing you loved most that they did in the past week?', true),
    (g_id, 'appreciation', 'light', 'ספר איך הם גרמו לך להרגיש אהוב/ה לאחרונה - בפרט אחד ספציפי', 'Tell how they made you feel loved recently - one specific detail', true),
    (g_id, 'appreciation', 'light', 'מה הסגולה שלהם שלדעתך לא מספיק מוערכת?', 'What quality of theirs do you think isn''t appreciated enough?', true),
    (g_id, 'appreciation', 'light', 'שלח הודעת קול עם מחמאה אמיתית לבן/בת הזוג עכשיו', 'Send a voice message with a genuine compliment to your partner right now', true),
    (g_id, 'appreciation', 'light', 'מה הדבר שהכי שמח אותך בקשר שלכם ב-3 חודשים האחרונים?', 'What made you happiest about your relationship in the last 3 months?', true),
    (g_id, 'appreciation', 'light', 'גע ביד הצד השני ואמור 3 דברים שמיוחדים בו/בה', 'Touch the other''s hand and say 3 things that are special about them', true),
    (g_id, 'appreciation', 'light', 'מה הזכרון הכי חם שיש לך מביחד שלכם?', 'What''s the warmest memory you have from being together?', true),
    (g_id, 'appreciation', 'light', 'ספר על רגע שהם הפתיעו אותך לטובה - ומה הרגשת', 'Tell about a moment they positively surprised you - and what you felt', true),
    (g_id, 'deep_connect', 'deep', 'מה הפחד הכי גדול שלך בקשר הזה שמעולם לא אמרת בקול?', 'What''s your biggest fear in this relationship that you''ve never said aloud?', true),
    (g_id, 'deep_connect', 'deep', 'אם הייתה יכול/ה לשנות דבר אחד בדרך שאתה/את מתקשר/ת - מה זה?', 'If you could change one thing about how you communicate - what would it be?', true),
    (g_id, 'deep_connect', 'deep', 'מה הצורך הרגשי שלך שאתה/את מרגיש/ה שלא תמיד מתמלא?', 'What emotional need do you feel isn''t always met?', true),
    (g_id, 'deep_connect', 'deep', 'ספר על רגע שהרגשת הכי קרוב/ה לבן/בת הזוג שלך', 'Tell about a moment you felt closest to your partner', true),
    (g_id, 'deep_connect', 'deep', 'מה הדבר שהכי קשה לך להגיד לבן/בת הזוג שלך - ולמה?', 'What''s the hardest thing for you to say to your partner - and why?', true),
    (g_id, 'deep_connect', 'deep', 'אם הקשר שלכם היה ספר - מה הפרק שנמצא עכשיו?', 'If your relationship were a book - what chapter are you in right now?', true),
    (g_id, 'deep_connect', 'deep', 'מה היה השינוי הכי גדול בך מאז שנכנסת לקשר הזה?', 'What''s the biggest change in you since entering this relationship?', true),
    (g_id, 'deep_connect', 'deep', 'אם יכולת לחזור לרגע אחד ביחד ולחיות אותו מחדש - מה זה?', 'If you could relive one moment together - what would it be?', true),
    (g_id, 'deep_connect', 'deep', 'מה מעניין אותך לגלות עוד על הצד השני שעדיין לא ידוע לך?', 'What are you curious to discover about your partner that you don''t know yet?', true),
    (g_id, 'memory', 'flirty', 'ספר את הרגע הראשון שהרגשת שזה משהו מיוחד ביניכם', 'Tell about the first moment you felt this was something special between you', true),
    (g_id, 'memory', 'flirty', 'מה היה הצחוק הכי גדול שלכם ביחד? חיקוי/ספר מחדש', 'What was your biggest laugh together? Re-enact/retell it', true),
    (g_id, 'memory', 'flirty', 'ספר על ויכוח שסיים בצחוק - ולמה זה הפך ליפה', 'Tell about an argument that ended in laughter - and why it became beautiful', true),
    (g_id, 'memory', 'flirty', 'מה הרגע שהכי שמחת שהצלמ/ה לא היה/ה שם?', 'What moment are you most glad the camera wasn''t there?', true),
    (g_id, 'memory', 'flirty', 'ספר על פעם שהיית גאה בבן/בת הזוג שלך בפני אחרים', 'Tell about a time you were proud of your partner in front of others', true),
    (g_id, 'memory', 'flirty', 'מה הדבר הכי ספונטני שעשיתם ביחד שלא תכננתם?', 'What''s the most spontaneous thing you did together that wasn''t planned?', true),
    (g_id, 'memory', 'flirty', 'ספר על רגע שהסתכלתם אחד על השני ובלי מילים - הכול היה ברור', 'Tell about a moment you looked at each other and without words - everything was clear', true),
    (g_id, 'memory', 'flirty', 'מה ה''בדיחה הפנימית'' שלכם שרק שניכם מבינים?', 'What''s your ''inside joke'' that only the two of you understand?', true),
    (g_id, 'couple_dare', 'flirty', 'חבקו אחד את השני למשך 60 שניות בשקט מלא - אל תפרדו', 'Hug each other for 60 seconds in complete silence - don''t let go', true),
    (g_id, 'couple_dare', 'flirty', 'האחד יסגור עיניים - השני ינחה אותם ב-3 נשיקות קלות לבחירתו', 'One closes eyes - the other guides 3 light kisses of their choice', true),
    (g_id, 'couple_dare', 'flirty', 'כתבו ביחד בעיניים עצומות ציור של הבית שתרצו לגור בו', 'With eyes closed together, draw the house you''d want to live in', true),
    (g_id, 'couple_dare', 'flirty', 'כל אחד מחזיק את יד השני ומרגיש - ואומר מה הוא מרגיש שם', 'Each holds the other''s hand and feels - then says what they feel there', true),
    (g_id, 'couple_dare', 'flirty', 'שבו פנים אל פנים, ענייניים לשניות 30 - ואז בחרו: מה אתם רוצים לומר?', 'Sit face to face, eye contact for 30 seconds - then choose: what do you want to say?', true),
    (g_id, 'couple_dare', 'flirty', 'ספרו ביחד ל-3 ואחרי כן כל אחד אומר משפט אחד לאחר בו-זמנית', 'Count to 3 together and then each says one sentence to the other simultaneously', true),
    (g_id, 'couple_dare', 'flirty', 'כל אחד כותב על נייר את הרגש שהוא מרגיש כרגע - מחליפים ורואים', 'Each writes on paper the emotion they feel right now - swap and see', true),
    (g_id, 'couple_dare', 'flirty', 'שחקו ''מראה'' - האחד מוביל תנועות, השני מחקה בדיוק - 2 דקות', 'Play ''mirror'' - one leads movements, the other copies exactly - 2 minutes', true),
    (g_id, 'future', 'deep', 'מה אתם רוצים שיהיה שונה בחיים שלכם בעוד 5 שנים?', 'What do you want to be different about your life in 5 years?', true),
    (g_id, 'future', 'deep', 'ספרו ביחד: מה המקום שאתם הכי רוצים לבקר ביחד?', 'Tell together: what''s the place you most want to visit together?', true),
    (g_id, 'future', 'deep', 'אם תוכלו לבנות את השגרה המושלמת שלכם - איך נראה היום המושלם?', 'If you could build your perfect routine - what does the perfect day look like?', true),
    (g_id, 'future', 'deep', 'מה הפחד שלכם לגבי העתיד שביחד יכולתם להתגבר עליו?', 'What''s your fear about the future that together you could overcome?', true),
    (g_id, 'future', 'deep', 'כל אחד אומר: ''בעוד 10 שנים אני רוצה שנהיה...''', 'Each says: ''In 10 years I want us to be...''', true),
    (g_id, 'future', 'deep', 'מה המנהג/מסורת שתרצו להקים ביחד כדי לחזק את הקשר?', 'What custom/tradition would you want to establish together to strengthen your bond?', true),
    (g_id, 'future', 'deep', 'ספרו ביחד חלום אחד משותף שעדיין לא דיברתם עליו בגלוי', 'Tell together one shared dream you haven''t spoken about openly yet', true),
    (g_id, 'future', 'deep', 'מה הדבר שהכי מפחיד אותך לבקש מבן/בת הזוג - ולמה?', 'What''s the thing you''re most afraid to ask your partner for - and why?', true);

END;
$$;

-- ────────────────────────────────────────────
-- GAME: חבר'ה ביחד (friends-party-spin)
-- ────────────────────────────────────────────
DO $$
DECLARE
  g_id uuid;
BEGIN

  INSERT INTO public.games
    (name_he, name_en, description_he, description_en, slug,
     is_active, bg_type, bg_value, player_mode)
  VALUES (
    'חבר''ה ביחד',
    'Friends Party Wheel',
    'גלגל המסיבה לחברים - אמת מביכה, אתגרים מגוחכים, מי הכי, סיפורים ופעילויות משוגעות.',
    'The party wheel for friends - embarrassing truth, silly dares, who''s most likely, stories and crazy activities.',
    'friends-party-spin',
    true, 'color', '#1a1200', false
  )
  ON CONFLICT (slug) DO UPDATE SET
    name_he = 'חבר''ה ביחד',
    name_en = 'Friends Party Wheel',
    description_he = 'גלגל המסיבה לחברים - אמת מביכה, אתגרים מגוחכים, מי הכי, סיפורים ופעילויות משוגעות.',
    description_en = 'The party wheel for friends - embarrassing truth, silly dares, who''s most likely, stories and crazy activities.',
    bg_type = 'color',
    bg_value = '#1a1200'
  RETURNING id INTO g_id;

  INSERT INTO public.wheel_configs
    (game_id, slices, pointer_color, inner_circle,
     inner_circle_color, inner_circle_border_color, border_color,
     divider_color, divider_enabled, divider_width,
     marker_config, category_colors, player_config)
  VALUES (
    g_id,
    '[{"id": "slice-truth_fun-0", "label_he": "😂 אמת כיפית", "label_en": "😂 Fun Truth", "color": "#F39C12", "question_type": "truth_fun"}, {"id": "slice-dare_silly-0", "label_he": "🎭 העז מגוחך", "label_en": "🎭 Silly Dare", "color": "#E67E22", "question_type": "dare_silly"}, {"id": "slice-who_most-0", "label_he": "👑 מי הכי?", "label_en": "👑 Who''s Most?", "color": "#F1C40F", "question_type": "who_most"}, {"id": "slice-story_share-0", "label_he": "📖 ספר לנו", "label_en": "📖 Tell Us", "color": "#FF6B35", "question_type": "story_share"}, {"id": "slice-activity_now-0", "label_he": "🏃 עשה עכשיו", "label_en": "🏃 Do It Now", "color": "#FFA726", "question_type": "activity_now"}, {"id": "slice-truth_fun-1", "label_he": "😂 אמת כיפית", "label_en": "😂 Fun Truth", "color": "#F39C12", "question_type": "truth_fun"}, {"id": "slice-dare_silly-1", "label_he": "🎭 העז מגוחך", "label_en": "🎭 Silly Dare", "color": "#E67E22", "question_type": "dare_silly"}, {"id": "slice-who_most-1", "label_he": "👑 מי הכי?", "label_en": "👑 Who''s Most?", "color": "#F1C40F", "question_type": "who_most"}, {"id": "slice-story_share-1", "label_he": "📖 ספר לנו", "label_en": "📖 Tell Us", "color": "#FF6B35", "question_type": "story_share"}, {"id": "slice-activity_now-1", "label_he": "🏃 עשה עכשיו", "label_en": "🏃 Do It Now", "color": "#FFA726", "question_type": "activity_now"}]'::jsonb,
    '#ffffff', true, '#1a1a2e', '#ffffff', '#ffffff',
    '#ffffff', true, 2,
    '{"marker_type": "none", "marker_color": "#ffffff", "marker_size": 8, "marker_count": 0, "marker_position": 0}'::jsonb,
    '{"truth_fun": "#F39C12", "dare_silly": "#E67E22", "who_most": "#F1C40F", "story_share": "#FF6B35", "activity_now": "#FFA726"}'::jsonb,
    '{"desired_total_slices": 10, "categories": [{"id": "cat-truth_fun", "key": "truth_fun", "label_he": "😂 אמת כיפית", "label_en": "😂 Fun Truth", "color": "#F39C12"}, {"id": "cat-dare_silly", "key": "dare_silly", "label_he": "🎭 העז מגוחך", "label_en": "🎭 Silly Dare", "color": "#E67E22"}, {"id": "cat-who_most", "key": "who_most", "label_he": "👑 מי הכי?", "label_en": "👑 Who''s Most?", "color": "#F1C40F"}, {"id": "cat-story_share", "key": "story_share", "label_he": "📖 ספר לנו", "label_en": "📖 Tell Us", "color": "#FF6B35"}, {"id": "cat-activity_now", "key": "activity_now", "label_he": "🏃 עשה עכשיו", "label_en": "🏃 Do It Now", "color": "#FFA726"}], "player_repetitions": 8}'::jsonb
  )
  ON CONFLICT (game_id) DO UPDATE SET
    slices = EXCLUDED.slices,
    category_colors = EXCLUDED.category_colors,
    player_config = EXCLUDED.player_config;

  -- Delete existing questions for this game (clean re-seed)
  DELETE FROM public.questions WHERE game_id = g_id;

  INSERT INTO public.questions
    (game_id, type, level, text_he, text_en, is_active)
  VALUES
    (g_id, 'truth_fun', 'light', 'מה הכי מביך שאמרת כשהיית שיכור/ה?', 'What''s the most embarrassing thing you''ve said while drunk?', true),
    (g_id, 'truth_fun', 'light', 'מי בחבורה הכי פחות תואם/ת לאדם שהוא/היא מנסה להיות?', 'Who in the group least matches the person they''re trying to be?', true),
    (g_id, 'truth_fun', 'light', 'מה הדבר שאתה מתבייש להודות שאתה אוהב - סרט, אוכל, שיר?', 'What''s something you''re embarrassed to admit you love - movie, food, song?', true),
    (g_id, 'truth_fun', 'light', 'ספר על פעם שניסית להיראות מגניב/ה ויצא בדיוק הפוך', 'Tell about a time you tried to look cool and it backfired completely', true),
    (g_id, 'truth_fun', 'light', 'מה הדבר הכי מוזר שחשבת עליו בשבוע האחרון?', 'What''s the weirdest thing you thought about in the past week?', true),
    (g_id, 'truth_fun', 'light', 'אם מישהו אחר בחדר היה צריך לספר סיפור מביך עליך - מי זה?', 'If someone else in the room had to tell an embarrassing story about you - who would it be?', true),
    (g_id, 'truth_fun', 'light', 'מה הדבר האחרון שחיפשת באינטרנט שהיית מתבייש שיראו?', 'What''s the last thing you searched online that you''d be embarrassed if seen?', true),
    (g_id, 'truth_fun', 'light', 'כמה זמן הלכת בלי מקלחת? תהיה כנה.', 'How long have you gone without showering? Be honest.', true),
    (g_id, 'truth_fun', 'light', 'מה הנאשמת/ת בו ביותר מצד חברים - ומאיפה זה בא?', 'What are you most accused of by friends - and where does it come from?', true),
    (g_id, 'dare_silly', 'light', 'עשה ריקוד של 30 שניות לשיר שאחד הנוכחים בוחר', 'Do a 30-second dance to a song one of those present chooses', true),
    (g_id, 'dare_silly', 'light', 'שיר בקול את הג''ינגל הראשון שעולה לך בראש', 'Sing aloud the first jingle that comes to your mind', true),
    (g_id, 'dare_silly', 'light', 'חקה את האדם משמאלך כשהוא הולך - קום ועשה עכשיו', 'Imitate the person to your left when they walk - get up and do it now', true),
    (g_id, 'dare_silly', 'light', 'כתוב הודעת וואטסאפ לאמא שלך ואמור לה ''אני כוכב לכת'' - הראה לנו', 'Write a WhatsApp message to your mom saying ''I am a planet'' - show us', true),
    (g_id, 'dare_silly', 'light', 'אכול כפית מהדבר הכי חריף שיש כרגע בסביבה', 'Eat a teaspoon of the spiciest thing available right now', true),
    (g_id, 'dare_silly', 'light', 'ספר בדיחה כה גרועה שכולם יאנחו - ולא יצחקו', 'Tell a joke so bad everyone will groan - and not laugh', true),
    (g_id, 'dare_silly', 'light', 'עשה סלפי עם הפנים הכי מגוחכות שאתה יכול ושתף בסטטוס', 'Make a selfie with the funniest face you can and share it as a status', true),
    (g_id, 'dare_silly', 'light', 'בלי ידיים - שתה מכוס בדרך היצירתית ביותר שתמצא', 'Without hands - drink from a cup in the most creative way you can find', true),
    (g_id, 'who_most', 'light', 'מי הכי סביר שייעלם לשנה לאי בגפו ויחזור שמח?', 'Who''s most likely to disappear to an island alone for a year and come back happy?', true),
    (g_id, 'who_most', 'light', 'מי הכי סביר שיהפוך לתוכן יוצר ויצבור מיליון עוקבים?', 'Who''s most likely to become a content creator and gain a million followers?', true),
    (g_id, 'who_most', 'light', 'מי הכי סביר שישכח את יום ההולדת של כולם - כולל שלו?', 'Who''s most likely to forget everyone''s birthday - including their own?', true),
    (g_id, 'who_most', 'light', 'מי הכי סביר שיתווכח עם מלצר על חשבון של 3 שקלים?', 'Who''s most likely to argue with a waiter over 3 shekels on the bill?', true),
    (g_id, 'who_most', 'light', 'מי הכי סביר שיכתוב ספר שאחד יקרא?', 'Who''s most likely to write a book that one person will read?', true),
    (g_id, 'who_most', 'light', 'מי הכי סביר שיצלח ממשחק ריאליטי ויפסיד בגמר?', 'Who''s most likely to excel at a reality show and lose in the final?', true),
    (g_id, 'who_most', 'light', 'מי הכי סביר שיהיה ראש עיר קטנה ויקלקל הכול?', 'Who''s most likely to become mayor of a small town and mess everything up?', true),
    (g_id, 'who_most', 'light', 'מי הכי סביר שיהיה עוד 20 שנה בדיוק אותו אדם - בדיוק אותן בעיות?', 'Who''s most likely to be the exact same person in 20 years - exact same problems?', true),
    (g_id, 'story_share', 'deep', 'ספר על הפעם שצחקת הכי הרבה בחיים שלך - מה קרה?', 'Tell about the time you laughed the hardest in your life - what happened?', true),
    (g_id, 'story_share', 'deep', 'ספר על פעם שהיית בטוח/ה שיש לך חבר/ה טוב/ה ויצא שלא', 'Tell about a time you were sure you had a good friend and turned out you didn''t', true),
    (g_id, 'story_share', 'deep', 'ספר על ההרפתקה הכי גדולה שעשית עם החברים האלה - או בכלל', 'Tell about the biggest adventure you''ve had with these friends - or ever', true),
    (g_id, 'story_share', 'deep', 'ספר על פעם שניסית לעשות טוב ויצא בדיוק הפוך', 'Tell about a time you tried to do good and it turned out the exact opposite', true),
    (g_id, 'story_share', 'deep', 'ספר על רגע שהיית בור וניסית להסתיר את זה - ונחשפת', 'Tell about a moment you were ignorant and tried to hide it - and got exposed', true),
    (g_id, 'story_share', 'deep', 'ספר על הנסיעה הכי בלתי נשכחת שלך - טובה או רעה', 'Tell about your most memorable trip - good or bad', true),
    (g_id, 'story_share', 'deep', 'ספר על פעם שפחדת מאוד ולא הראית לאחרים', 'Tell about a time you were very scared and didn''t show it to others', true),
    (g_id, 'activity_now', 'light', 'כולם קמים ועושים 15 קפיצות ביחד - בסנכרון מלא', 'Everyone gets up and does 15 jumps together - in full sync', true),
    (g_id, 'activity_now', 'light', 'מי שפתח אחרון את הטלפון - מציג את הסלפי האחרון שלו/ה לכולם', 'Whoever last opened their phone - shows their last selfie to everyone', true),
    (g_id, 'activity_now', 'light', 'כולם עושים לאדם משמאלם מחמאה אמיתית - בתורות', 'Everyone gives a genuine compliment to the person on their left - in turns', true),
    (g_id, 'activity_now', 'light', 'כולם שרים ביחד 10 שניות של שיר שהולך הכי שנון כרגע', 'Everyone sings together 10 seconds of the catchiest song right now', true),
    (g_id, 'activity_now', 'light', 'כל אחד שולף מהטלפון הצילום המביך ביותר שלו ומסביר', 'Everyone pulls out their most embarrassing photo from their phone and explains', true),
    (g_id, 'activity_now', 'light', 'כולם מחקים את הבן-אדם שמולם בדיוק - 20 שניות', 'Everyone imitates the person in front of them exactly - 20 seconds', true),
    (g_id, 'activity_now', 'light', 'כל אחד כותב על נייר שם של חבר/ה ואיך יתאר אותו/ה במילה אחת - ומקריא', 'Each writes a friend''s name and describes them in one word - reads aloud', true),
    (g_id, 'activity_now', 'light', 'כולם עושים את הצליל הכי מוזר שהם יכולים - ב-3,2,1 ביחד', 'Everyone makes the weirdest sound they can - on 3,2,1 together', true);

END;
$$;

-- ────────────────────────────────────────────
-- GAME: ניצוצות אינטימיים (intimate-sparks-spin)
-- ────────────────────────────────────────────
DO $$
DECLARE
  g_id uuid;
BEGIN

  INSERT INTO public.games
    (name_he, name_en, description_he, description_en, slug,
     is_active, bg_type, bg_value, player_mode)
  VALUES (
    'ניצוצות אינטימיים',
    'Intimate Sparks Wheel',
    'לזוגות - נגיעות, לחישות, גילויים חושניים ומשימות אינטימיות שמחברות מחדש.',
    'For couples - touches, whispers, sensual revelations and intimate missions that reconnect.',
    'intimate-sparks-spin',
    true, 'color', '#0d0006', false
  )
  ON CONFLICT (slug) DO UPDATE SET
    name_he = 'ניצוצות אינטימיים',
    name_en = 'Intimate Sparks Wheel',
    description_he = 'לזוגות - נגיעות, לחישות, גילויים חושניים ומשימות אינטימיות שמחברות מחדש.',
    description_en = 'For couples - touches, whispers, sensual revelations and intimate missions that reconnect.',
    bg_type = 'color',
    bg_value = '#0d0006'
  RETURNING id INTO g_id;

  INSERT INTO public.wheel_configs
    (game_id, slices, pointer_color, inner_circle,
     inner_circle_color, inner_circle_border_color, border_color,
     divider_color, divider_enabled, divider_width,
     marker_config, category_colors, player_config)
  VALUES (
    g_id,
    '[{"id": "slice-touch_tender-0", "label_he": "🤲 נגיעה", "label_en": "🤲 Touch", "color": "#8B0000", "question_type": "touch_tender"}, {"id": "slice-whisper_say-0", "label_he": "💋 לחש לי", "label_en": "💋 Whisper", "color": "#C41E3A", "question_type": "whisper_say"}, {"id": "slice-reveal_heart-0", "label_he": "🌹 גלה", "label_en": "🌹 Reveal", "color": "#B8860B", "question_type": "reveal_heart"}, {"id": "slice-together_now-0", "label_he": "💑 ביחד", "label_en": "💑 Together", "color": "#A0522D", "question_type": "together_now"}, {"id": "slice-feel_share-0", "label_he": "❤️ הרגש", "label_en": "❤️ Feel & Share", "color": "#DC143C", "question_type": "feel_share"}, {"id": "slice-touch_tender-1", "label_he": "🤲 נגיעה", "label_en": "🤲 Touch", "color": "#8B0000", "question_type": "touch_tender"}, {"id": "slice-whisper_say-1", "label_he": "💋 לחש לי", "label_en": "💋 Whisper", "color": "#C41E3A", "question_type": "whisper_say"}, {"id": "slice-reveal_heart-1", "label_he": "🌹 גלה", "label_en": "🌹 Reveal", "color": "#B8860B", "question_type": "reveal_heart"}, {"id": "slice-together_now-1", "label_he": "💑 ביחד", "label_en": "💑 Together", "color": "#A0522D", "question_type": "together_now"}, {"id": "slice-feel_share-1", "label_he": "❤️ הרגש", "label_en": "❤️ Feel & Share", "color": "#DC143C", "question_type": "feel_share"}]'::jsonb,
    '#ffffff', true, '#1a1a2e', '#ffffff', '#ffffff',
    '#ffffff', true, 2,
    '{"marker_type": "none", "marker_color": "#ffffff", "marker_size": 8, "marker_count": 0, "marker_position": 0}'::jsonb,
    '{"touch_tender": "#8B0000", "whisper_say": "#C41E3A", "reveal_heart": "#B8860B", "together_now": "#A0522D", "feel_share": "#DC143C"}'::jsonb,
    '{"desired_total_slices": 10, "categories": [{"id": "cat-touch_tender", "key": "touch_tender", "label_he": "🤲 נגיעה", "label_en": "🤲 Touch", "color": "#8B0000"}, {"id": "cat-whisper_say", "key": "whisper_say", "label_he": "💋 לחש לי", "label_en": "💋 Whisper", "color": "#C41E3A"}, {"id": "cat-reveal_heart", "key": "reveal_heart", "label_he": "🌹 גלה", "label_en": "🌹 Reveal", "color": "#B8860B"}, {"id": "cat-together_now", "key": "together_now", "label_he": "💑 ביחד", "label_en": "💑 Together", "color": "#A0522D"}, {"id": "cat-feel_share", "key": "feel_share", "label_he": "❤️ הרגש", "label_en": "❤️ Feel & Share", "color": "#DC143C"}], "player_repetitions": 8}'::jsonb
  )
  ON CONFLICT (game_id) DO UPDATE SET
    slices = EXCLUDED.slices,
    category_colors = EXCLUDED.category_colors,
    player_config = EXCLUDED.player_config;

  -- Delete existing questions for this game (clean re-seed)
  DELETE FROM public.questions WHERE game_id = g_id;

  INSERT INTO public.questions
    (game_id, type, level, text_he, text_en, is_active)
  VALUES
    (g_id, 'touch_tender', 'flirty', 'לאט מאוד - עבור בקצות אצבעותיך על הגב של הצד השני, מהכתף לכתף', 'Slowly - trace your fingertips across the other''s back, shoulder to shoulder', true),
    (g_id, 'touch_tender', 'flirty', 'קח/י את יד הצד השני ושחק/י בעדינות עם האצבעות - בלי מילים, דקה שלמה', 'Take the other''s hand and play gently with the fingers - no words, one full minute', true),
    (g_id, 'touch_tender', 'flirty', 'הצמד/י את המצח שלך אל המצח שלהם וסגור/י עיניים - 30 שניות', 'Press your forehead to theirs and close your eyes - 30 seconds', true),
    (g_id, 'touch_tender', 'flirty', 'עסה/י בעדינות את הכתפיים של הצד השני - 2 דקות מלאות', 'Gently massage the other person''s shoulders - 2 full minutes', true),
    (g_id, 'touch_tender', 'flirty', 'גע/י בלחי הצד השני בכף ידך ותן/י לה לנוח שם - ותסתכלו זה לזה', 'Touch the other''s cheek with your palm and let it rest there - and look at each other', true),
    (g_id, 'touch_tender', 'flirty', 'קח/י את הראש של הצד השני בין ידיך בעדינות ותנשק/י את המצח', 'Take the other''s head gently between your hands and kiss their forehead', true),
    (g_id, 'touch_tender', 'flirty', 'שב/י מאחורי הצד השני ועבור/י לאט בעדינות על שערם - 2 דקות', 'Sit behind the other person and slowly, gently run your fingers through their hair - 2 min', true),
    (g_id, 'touch_tender', 'flirty', 'אחז/י בשתי ידיים של הצד השני ותמשוך/י אותם אליך לחיבוק איטי', 'Hold both of the other''s hands and pull them slowly into a hug', true),
    (g_id, 'whisper_say', 'flirty', 'לחוש באוזן של הצד השני: ''הדבר שהכי מושך אותי בך הוא...''', 'Whisper in the other''s ear: ''The thing that attracts me most about you is...''', true),
    (g_id, 'whisper_say', 'flirty', 'לחוש: ''בפעם האחרונה שהסתכלתי עליך חשבתי...''', 'Whisper: ''The last time I looked at you I thought...''', true),
    (g_id, 'whisper_say', 'flirty', 'לחוש משהו שרצית להגיד בשבוע האחרון ולא הגדת', 'Whisper something you wanted to say in the past week and didn''t', true),
    (g_id, 'whisper_say', 'flirty', 'לחוש: ''הרגע הכי חושני שהיה לנו היה...'' ותאר/י', 'Whisper: ''The most sensual moment we had was...'' and describe it', true),
    (g_id, 'whisper_say', 'flirty', 'לחוש: ''כשאתה/ת עושה _____ זה גורם לי להרגיש ___''', 'Whisper: ''When you do _____ it makes me feel _____''', true),
    (g_id, 'whisper_say', 'flirty', 'לחוש: ''המקום שאני הכי רוצה שתגע/י בו עכשיו הוא...''', 'Whisper: ''The place I most want you to touch right now is...''', true),
    (g_id, 'whisper_say', 'flirty', 'לחוש: ''פנטזיה קטנה שיש לי עליך היא...''', 'Whisper: ''A small fantasy I have about you is...''', true),
    (g_id, 'whisper_say', 'flirty', 'לחוש באוזן: ''שלוש מילים שמתארות איך אתה/ת גורם/ת לי להרגיש''', 'Whisper in their ear: ''Three words describing how you make me feel''', true),
    (g_id, 'reveal_heart', 'deep', 'גלה מה המקום הגופני שהכי נעים לך שנוגעים בו - ופרט', 'Reveal the physical place that feels most pleasant when touched - and detail', true),
    (g_id, 'reveal_heart', 'deep', 'ספר מה הכי מדליק/ה אותך רגשית אצל הצד השני', 'Tell what emotionally arouses you most about the other person', true),
    (g_id, 'reveal_heart', 'deep', 'גלה פנטזיה רומנטית אחת שעדיין לא הגשמתם ביחד', 'Reveal one romantic fantasy you haven''t fulfilled together yet', true),
    (g_id, 'reveal_heart', 'deep', 'ספר מה הזמן שהרגשת הכי חושני/ת ורצית שהוא לא ייגמר', 'Tell about the time you felt most sensual and wanted it not to end', true),
    (g_id, 'reveal_heart', 'deep', 'גלה מה הצליל, הריח, או המגע שהכי מרגיע אותך אצל הצד השני', 'Reveal what sound, smell, or touch from the other person most calms you', true),
    (g_id, 'reveal_heart', 'deep', 'ספר מה הדבר שרצית לנסות ביחד ועוד לא העזתם', 'Tell about something you''ve wanted to try together and haven''t dared yet', true),
    (g_id, 'reveal_heart', 'deep', 'גלה מה גורם לך להרגיש הכי נראה/ת ואהוב/ה על ידי הצד השני', 'Reveal what makes you feel most seen and loved by the other person', true),
    (g_id, 'reveal_heart', 'deep', 'ספר מה הציפייה האחת שלך מהצד השני שלא בא לידי ביטוי מספיק', 'Tell about one expectation from your partner that isn''t expressed enough', true),
    (g_id, 'together_now', 'flirty', 'כבו אורות, הדליקו נר אחד ושבו שתיקה בנוכחות אחד של השני - 3 דקות', 'Turn off lights, light one candle and sit in silence in each other''s presence - 3 min', true),
    (g_id, 'together_now', 'flirty', 'כל אחד בוחר שיר שמייצג אותו/ה - ושומעים ביחד בשתיקה', 'Each picks a song that represents them - and you listen together in silence', true),
    (g_id, 'together_now', 'flirty', 'הכינו ביחד כוס משקה חם - האחד מכין, השני בוחר - ושתו ביחד', 'Prepare a hot drink together - one makes it, the other chooses - and drink together', true),
    (g_id, 'together_now', 'flirty', 'שרו ביחד את ה-refrain של השיר שנגן בפעם הראשונה שהייתם ביחד', 'Sing together the chorus of the song playing when you were first together', true),
    (g_id, 'together_now', 'flirty', 'עשו עיסוי ידיים הדדי - 2 דקות כל אחד, אחרי כן מחליפים', 'Give each other hand massages - 2 minutes each, then switch', true),
    (g_id, 'together_now', 'flirty', 'כתבו ביחד רשימה של 10 דברים שאתם אוהבים לעשות ביחד', 'Write together a list of 10 things you love doing together', true),
    (g_id, 'together_now', 'flirty', 'שבו גב אל גב, עצמו עיניים, ונשמו ביחד 10 נשימות עמוקות', 'Sit back to back, close your eyes, and breathe together 10 deep breaths', true),
    (g_id, 'together_now', 'flirty', 'כל אחד מצייר את הפנים של השני מבלי להסתכל על הנייר - ומראה', 'Each draws the other''s face without looking at the paper - then shows', true),
    (g_id, 'feel_share', 'deep', 'ספר ברגע זה: ''כשאני איתך אני מרגיש/ה...'' - השלם עם 3 רגשות', 'Say right now: ''When I''m with you I feel...'' - complete with 3 emotions', true),
    (g_id, 'feel_share', 'deep', 'מה הרגשת עם הלב שלך כשהצד השני נכנס לחדר היום?', 'What did you feel in your heart when the other person entered the room today?', true),
    (g_id, 'feel_share', 'deep', 'מה הדבר שהכי מרגש אותך אצל הצד השני - בשגרה היומיומית?', 'What moves you most about the other person - in everyday routine?', true),
    (g_id, 'feel_share', 'deep', 'ספר על רגע שהרגשת שאתם שניים הכי בטוחים בעולם', 'Tell about a moment you both felt safest in the world', true),
    (g_id, 'feel_share', 'deep', 'מה הרגש שאתה/ת מתקשה/ת לבטא ורוצה/ת שהצד השני ידע?', 'What emotion do you find hard to express and want the other person to know?', true),
    (g_id, 'feel_share', 'deep', 'ספר מה מרגיש לך ה''בית'' בקשר הזה - מה זה נראה?', 'Tell what ''home'' feels like in this relationship - what does it look like?', true),
    (g_id, 'feel_share', 'deep', 'מה הדבר שגורם לך להרגיש הכי אהוב/ה על ידי הצד השני?', 'What makes you feel most loved by the other person?', true),
    (g_id, 'feel_share', 'deep', 'אם הקשר שלכם היה ריח - איזה ריח הוא היה ולמה?', 'If your relationship had a scent - what scent would it be and why?', true);

END;
$$;

-- ────────────────────────────────────────────
-- GAME: התחדשות הזוג (couple-renewal-spin)
-- ────────────────────────────────────────────
DO $$
DECLARE
  g_id uuid;
BEGIN

  INSERT INTO public.games
    (name_he, name_en, description_he, description_en, slug,
     is_active, bg_type, bg_value, player_mode)
  VALUES (
    'התחדשות הזוג',
    'Couple Renewal Wheel',
    'לזוגות ותיקים - להחזיר ניצוצות, לומר מה שלא נאמר, לגלות מחדש ולחלום ביחד.',
    'For established couples - reignite sparks, say what''s unsaid, rediscover each other and dream together.',
    'couple-renewal-spin',
    true, 'color', '#001020', false
  )
  ON CONFLICT (slug) DO UPDATE SET
    name_he = 'התחדשות הזוג',
    name_en = 'Couple Renewal Wheel',
    description_he = 'לזוגות ותיקים - להחזיר ניצוצות, לומר מה שלא נאמר, לגלות מחדש ולחלום ביחד.',
    description_en = 'For established couples - reignite sparks, say what''s unsaid, rediscover each other and dream together.',
    bg_type = 'color',
    bg_value = '#001020'
  RETURNING id INTO g_id;

  INSERT INTO public.wheel_configs
    (game_id, slices, pointer_color, inner_circle,
     inner_circle_color, inner_circle_border_color, border_color,
     divider_color, divider_enabled, divider_width,
     marker_config, category_colors, player_config)
  VALUES (
    g_id,
    '[{"id": "slice-unsaid_words-0", "label_he": "💬 לא נאמר", "label_en": "💬 Unsaid", "color": "#1565C0", "question_type": "unsaid_words"}, {"id": "slice-gratitude_real-0", "label_he": "🙏 תודה אמיתית", "label_en": "🙏 Real Gratitude", "color": "#283593", "question_type": "gratitude_real"}, {"id": "slice-rediscover-0", "label_he": "🔍 גלה מחדש", "label_en": "🔍 Rediscover", "color": "#0277BD", "question_type": "rediscover"}, {"id": "slice-dare_reconnect-0", "label_he": "✅ אתגר חיבור", "label_en": "✅ Reconnect Dare", "color": "#006064", "question_type": "dare_reconnect"}, {"id": "slice-vision_share-0", "label_he": "🌙 חזון משותף", "label_en": "🌙 Shared Vision", "color": "#37474F", "question_type": "vision_share"}, {"id": "slice-unsaid_words-1", "label_he": "💬 לא נאמר", "label_en": "💬 Unsaid", "color": "#1565C0", "question_type": "unsaid_words"}, {"id": "slice-gratitude_real-1", "label_he": "🙏 תודה אמיתית", "label_en": "🙏 Real Gratitude", "color": "#283593", "question_type": "gratitude_real"}, {"id": "slice-rediscover-1", "label_he": "🔍 גלה מחדש", "label_en": "🔍 Rediscover", "color": "#0277BD", "question_type": "rediscover"}, {"id": "slice-dare_reconnect-1", "label_he": "✅ אתגר חיבור", "label_en": "✅ Reconnect Dare", "color": "#006064", "question_type": "dare_reconnect"}, {"id": "slice-vision_share-1", "label_he": "🌙 חזון משותף", "label_en": "🌙 Shared Vision", "color": "#37474F", "question_type": "vision_share"}]'::jsonb,
    '#ffffff', true, '#1a1a2e', '#ffffff', '#ffffff',
    '#ffffff', true, 2,
    '{"marker_type": "none", "marker_color": "#ffffff", "marker_size": 8, "marker_count": 0, "marker_position": 0}'::jsonb,
    '{"unsaid_words": "#1565C0", "gratitude_real": "#283593", "rediscover": "#0277BD", "dare_reconnect": "#006064", "vision_share": "#37474F"}'::jsonb,
    '{"desired_total_slices": 10, "categories": [{"id": "cat-unsaid_words", "key": "unsaid_words", "label_he": "💬 לא נאמר", "label_en": "💬 Unsaid", "color": "#1565C0"}, {"id": "cat-gratitude_real", "key": "gratitude_real", "label_he": "🙏 תודה אמיתית", "label_en": "🙏 Real Gratitude", "color": "#283593"}, {"id": "cat-rediscover", "key": "rediscover", "label_he": "🔍 גלה מחדש", "label_en": "🔍 Rediscover", "color": "#0277BD"}, {"id": "cat-dare_reconnect", "key": "dare_reconnect", "label_he": "✅ אתגר חיבור", "label_en": "✅ Reconnect Dare", "color": "#006064"}, {"id": "cat-vision_share", "key": "vision_share", "label_he": "🌙 חזון משותף", "label_en": "🌙 Shared Vision", "color": "#37474F"}], "player_repetitions": 8}'::jsonb
  )
  ON CONFLICT (game_id) DO UPDATE SET
    slices = EXCLUDED.slices,
    category_colors = EXCLUDED.category_colors,
    player_config = EXCLUDED.player_config;

  -- Delete existing questions for this game (clean re-seed)
  DELETE FROM public.questions WHERE game_id = g_id;

  INSERT INTO public.questions
    (game_id, type, level, text_he, text_en, is_active)
  VALUES
    (g_id, 'unsaid_words', 'deep', 'אמור משהו שרצית להגיד השבוע לבן/בת הזוג ולא הגדת', 'Say something you wanted to tell your partner this week and didn''t', true),
    (g_id, 'unsaid_words', 'deep', 'מה הדבר שאתה/ת מרגיש/ה שלא מקבל/ת בקשר - ועוד לא אמרת?', 'What do you feel you''re not getting in the relationship - and haven''t said yet?', true),
    (g_id, 'unsaid_words', 'deep', 'מה הייתת רוצה לשמוע מהצד השני יותר - בתדירות, בעומק?', 'What would you like to hear from the other person more - more often, more deeply?', true),
    (g_id, 'unsaid_words', 'deep', 'ספר על פעם שנפגעת ולא אמרת - ועדיין זה נשאר בלב', 'Tell about a time you were hurt and didn''t say so - and it still stays with you', true),
    (g_id, 'unsaid_words', 'deep', 'מה ציפייה אחת שיש לך מהצד השני שמעולם לא ביטאת בבירור?', 'What''s one expectation you have from your partner you''ve never clearly expressed?', true),
    (g_id, 'unsaid_words', 'deep', 'מה הרגע שרצית מחיבוק ולא ביקשת?', 'What''s the moment you wanted a hug and didn''t ask?', true),
    (g_id, 'unsaid_words', 'deep', 'מה הגבול שחשוב לך שהצד השני יכבד - ועוד לא הצבת?', 'What''s a boundary important to you that your partner should respect - and you haven''t set?', true),
    (g_id, 'unsaid_words', 'deep', 'אמור: ''הדבר שהכי קשה לי לבקש ממך הוא...'' וסיים את המשפט', 'Say: ''The hardest thing for me to ask of you is...'' and complete the sentence', true),
    (g_id, 'unsaid_words', 'deep', 'מה הנושא שאתם נמנעים ממנו בזמן האחרון - ואיך נוכל לפתוח אותו?', 'What topic have you been avoiding lately - and how could you open it?', true),
    (g_id, 'gratitude_real', 'light', 'ספר על רגע אחד מהחיים שלכם שאתה/ת אסיר/ת תודה עליו', 'Tell about one moment in your life together you''re grateful for', true),
    (g_id, 'gratitude_real', 'light', 'מה הדבר שהצד השני עשה בשנה האחרונה שהכי נגע ללבך?', 'What did your partner do in the past year that touched your heart most?', true),
    (g_id, 'gratitude_real', 'light', 'תודה על דבר שהצד השני עושה בשגרה שנראה קטן אבל משמעותי', 'Thank your partner for something routine they do that seems small but is meaningful', true),
    (g_id, 'gratitude_real', 'light', 'מה היית גרוע/ה בו בלי הצד השני?', 'What would you be worse at without your partner?', true),
    (g_id, 'gratitude_real', 'light', 'אמור בקול: ''אני שמח/ה שאתה/ת בחיים שלי כי...'' - 3 סיבות', 'Say aloud: ''I''m glad you''re in my life because...'' - 3 reasons', true),
    (g_id, 'gratitude_real', 'light', 'מה הצד השני לימד אותך שלא ידעת קודם?', 'What did your partner teach you that you didn''t know before?', true),
    (g_id, 'gratitude_real', 'light', 'אחז/י בידי הצד השני ואמור/י תודה על הזמן שלכם ביחד', 'Hold your partner''s hands and say thank you for the time you have together', true),
    (g_id, 'gratitude_real', 'light', 'מה הזכרון אחד מהקשר שאתה/ת בטוח/ה לא תשכח לעולם?', 'What''s one memory from the relationship you''re sure you''ll never forget?', true),
    (g_id, 'rediscover', 'flirty', 'שאל/י שאלה שמעולם לא שאלת את בן/בת הזוג - על ילדות, חלום, פחד', 'Ask a question you''ve never asked your partner - about childhood, dream, fear', true),
    (g_id, 'rediscover', 'flirty', 'מה עניין חדש או תחום שהצד השני פיתח ואתה/ת עדיין לא ממש מכיר/ה?', 'What new interest or field has your partner developed that you don''t really know yet?', true),
    (g_id, 'rediscover', 'flirty', 'מה הדבר שגילית על הצד השני בחצי השנה האחרונה שהפתיע אותך?', 'What did you discover about your partner in the last six months that surprised you?', true),
    (g_id, 'rediscover', 'flirty', 'תאר/י מה לדעתך הצד השני הכי שמח בו בחיים כרגע', 'Describe what you think your partner is happiest about in life right now', true),
    (g_id, 'rediscover', 'flirty', 'מה שינוי חיובי אחד שאתה/ת מבחין/ה בבן/בת הזוג מאז שהכרתם?', 'What''s one positive change you notice in your partner since you met?', true),
    (g_id, 'rediscover', 'flirty', 'ספר מה אתה/ת חושב/ת שהצד השני הכי גאה בו - ומדוע?', 'Tell what you think your partner is most proud of - and why?', true),
    (g_id, 'rediscover', 'flirty', 'מה תשאל/י את הצד השני אם ידעת שהוא/היא ייענה/ייענו בכנות מלאה?', 'What would you ask your partner if you knew they''d answer with complete honesty?', true),
    (g_id, 'rediscover', 'flirty', 'מה משהו שאתה/ת עדיין מגלה על עצמך - ורוצה/ת לשתף?', 'What''s something you''re still discovering about yourself - and want to share?', true),
    (g_id, 'dare_reconnect', 'flirty', 'כבו את הטלפונים, שבו פנים אל פנים - ושיחה של 15 דקות רק על אתם', 'Turn off phones, sit face to face - conversation for 15 minutes only about you two', true),
    (g_id, 'dare_reconnect', 'flirty', 'צאו לטיול של 10 דקות ביחד עכשיו - בלי יעד, רק ביחד', 'Go for a 10-minute walk together right now - no destination, just together', true),
    (g_id, 'dare_reconnect', 'flirty', 'הכינו ביחד אוכל קטן - כל אחד מביא מרכיב אחד - ואוכלים', 'Prepare a small food together - each brings one ingredient - and eat it', true),
    (g_id, 'dare_reconnect', 'flirty', 'שחקו 20 שניות של ''ג''אסטה'' - מי שמצחיק ראשון מפסיד', 'Play 20 seconds of ''Don''t laugh'' - whoever laughs first loses', true),
    (g_id, 'dare_reconnect', 'flirty', 'כל אחד כותב 3 הבטחות קטנות לשבוע הקרוב לצד השני - ומקריא', 'Each writes 3 small promises for the next week to the other - and reads aloud', true),
    (g_id, 'dare_reconnect', 'flirty', 'חבקו אחד את השני ו''תחזיקו'' 90 שניות - כי אוקסיטוצין מתחיל שם', 'Hug each other and ''hold on'' for 90 seconds - because oxytocin starts there', true),
    (g_id, 'dare_reconnect', 'flirty', 'ספרו ביחד 3 דברים שאתם מסכימים עליהם - ו-1 שאתם לא', 'Tell together 3 things you agree on - and 1 thing you don''t', true),
    (g_id, 'dare_reconnect', 'flirty', 'תכננו תאריך לשעה קרובה שלא קשורה לשגרה - ותאמרו מה הוא', 'Plan a date for the near future unrelated to routine - and say what it is', true),
    (g_id, 'vision_share', 'deep', 'ספרו ביחד: איך נראה הבית שאתם רוצים בעוד 5 שנים - פרטים', 'Tell together: what does the home you want in 5 years look like - details', true),
    (g_id, 'vision_share', 'deep', 'מה הדבר שאתם רוצים לשנות בחיים שלכם יחד ב-12 חודשים הקרובים?', 'What do you want to change together in your life in the next 12 months?', true),
    (g_id, 'vision_share', 'deep', 'אם תוכלו לקחת חופשה בלי הגבלות - אן תלכו ומה תעשו?', 'If you could take a vacation without restrictions - where would you go and what would you do?', true),
    (g_id, 'vision_share', 'deep', 'מה המשפחה שאתם בונים - ערכים, טקסים, דרך חיים שאתם בוחרים?', 'What''s the family you''re building - values, rituals, way of life you''re choosing?', true),
    (g_id, 'vision_share', 'deep', 'כל אחד אומר: ''בעוד 10 שנים אני רואה אותנו...'' ומשלים', 'Each says: ''In 10 years I see us...'' and completes the sentence', true),
    (g_id, 'vision_share', 'deep', 'מה הדבר שהכי מפחיד אותך בעתיד המשותף שלכם - ומה שנותן לך שלווה?', 'What scares you most about your shared future - and what gives you peace?', true),
    (g_id, 'vision_share', 'deep', 'מה מנהג אחד שתרצו לאמץ כזוג שיחזק אתכם?', 'What''s one custom you''d like to adopt as a couple that will strengthen you?', true);

END;
$$;

-- ────────────────────────────────────────────
-- GAME: טוב ממסעדה וסרט (better-date-spin)
-- ────────────────────────────────────────────
DO $$
DECLARE
  g_id uuid;
BEGIN

  INSERT INTO public.games
    (name_he, name_en, description_he, description_en, slug,
     is_active, bg_type, bg_value, player_mode)
  VALUES (
    'טוב ממסעדה וסרט',
    'Better Than Movie & Restaurant',
    'ערב שונה, חוויתי ומרגש - יוצרים, חולמים, מתכננים ומחייכים ביחד יותר מכל סרט.',
    'A different, experiential and exciting evening - creating, dreaming, planning and smiling together more than any movie.',
    'better-date-spin',
    true, 'color', '#001a0d', false
  )
  ON CONFLICT (slug) DO UPDATE SET
    name_he = 'טוב ממסעדה וסרט',
    name_en = 'Better Than Movie & Restaurant',
    description_he = 'ערב שונה, חוויתי ומרגש - יוצרים, חולמים, מתכננים ומחייכים ביחד יותר מכל סרט.',
    description_en = 'A different, experiential and exciting evening - creating, dreaming, planning and smiling together more than any movie.',
    bg_type = 'color',
    bg_value = '#001a0d'
  RETURNING id INTO g_id;

  INSERT INTO public.wheel_configs
    (game_id, slices, pointer_color, inner_circle,
     inner_circle_color, inner_circle_border_color, border_color,
     divider_color, divider_enabled, divider_width,
     marker_config, category_colors, player_config)
  VALUES (
    g_id,
    '[{"id": "slice-create_together-0", "label_he": "🎨 יצירה", "label_en": "🎨 Create", "color": "#00897B", "question_type": "create_together"}, {"id": "slice-mini_adventure-0", "label_he": "🗺️ הרפתקה", "label_en": "🗺️ Adventure", "color": "#2E7D32", "question_type": "mini_adventure"}, {"id": "slice-bucket_item-0", "label_he": "📋 חלום לממש", "label_en": "📋 Bucket Dream", "color": "#0097A7", "question_type": "bucket_item"}, {"id": "slice-fun_challenge-0", "label_he": "🎮 אתגר כיף", "label_en": "🎮 Fun Challenge", "color": "#388E3C", "question_type": "fun_challenge"}, {"id": "slice-plan_dream-0", "label_he": "📅 תכנון עתיד", "label_en": "📅 Plan the Future", "color": "#00695C", "question_type": "plan_dream"}, {"id": "slice-create_together-1", "label_he": "🎨 יצירה", "label_en": "🎨 Create", "color": "#00897B", "question_type": "create_together"}, {"id": "slice-mini_adventure-1", "label_he": "🗺️ הרפתקה", "label_en": "🗺️ Adventure", "color": "#2E7D32", "question_type": "mini_adventure"}, {"id": "slice-bucket_item-1", "label_he": "📋 חלום לממש", "label_en": "📋 Bucket Dream", "color": "#0097A7", "question_type": "bucket_item"}, {"id": "slice-fun_challenge-1", "label_he": "🎮 אתגר כיף", "label_en": "🎮 Fun Challenge", "color": "#388E3C", "question_type": "fun_challenge"}, {"id": "slice-plan_dream-1", "label_he": "📅 תכנון עתיד", "label_en": "📅 Plan the Future", "color": "#00695C", "question_type": "plan_dream"}]'::jsonb,
    '#ffffff', true, '#1a1a2e', '#ffffff', '#ffffff',
    '#ffffff', true, 2,
    '{"marker_type": "none", "marker_color": "#ffffff", "marker_size": 8, "marker_count": 0, "marker_position": 0}'::jsonb,
    '{"create_together": "#00897B", "mini_adventure": "#2E7D32", "bucket_item": "#0097A7", "fun_challenge": "#388E3C", "plan_dream": "#00695C"}'::jsonb,
    '{"desired_total_slices": 10, "categories": [{"id": "cat-create_together", "key": "create_together", "label_he": "🎨 יצירה", "label_en": "🎨 Create", "color": "#00897B"}, {"id": "cat-mini_adventure", "key": "mini_adventure", "label_he": "🗺️ הרפתקה", "label_en": "🗺️ Adventure", "color": "#2E7D32"}, {"id": "cat-bucket_item", "key": "bucket_item", "label_he": "📋 חלום לממש", "label_en": "📋 Bucket Dream", "color": "#0097A7"}, {"id": "cat-fun_challenge", "key": "fun_challenge", "label_he": "🎮 אתגר כיף", "label_en": "🎮 Fun Challenge", "color": "#388E3C"}, {"id": "cat-plan_dream", "key": "plan_dream", "label_he": "📅 תכנון עתיד", "label_en": "📅 Plan the Future", "color": "#00695C"}], "player_repetitions": 8}'::jsonb
  )
  ON CONFLICT (game_id) DO UPDATE SET
    slices = EXCLUDED.slices,
    category_colors = EXCLUDED.category_colors,
    player_config = EXCLUDED.player_config;

  -- Delete existing questions for this game (clean re-seed)
  DELETE FROM public.questions WHERE game_id = g_id;

  INSERT INTO public.questions
    (game_id, type, level, text_he, text_en, is_active)
  VALUES
    (g_id, 'create_together', 'light', 'כתבו ביחד שיר של 4 שורות על הערב שלכם - כל אחד כותב שורה לסירוגין', 'Write together a 4-line poem about your evening - each writes one line alternately', true),
    (g_id, 'create_together', 'light', 'צייר/י ביחד ציור של ''הבית שלנו'' - כל אחד מוסיף פרט בתורו', 'Draw together a picture of ''our home'' - each adds a detail in turn', true),
    (g_id, 'create_together', 'light', 'המציאו ביחד קוקטייל/שייק חדש מהמרכיבים שיש עכשיו - ושמו', 'Invent a new cocktail/shake together from available ingredients - and name it', true),
    (g_id, 'create_together', 'light', 'ספרו ביחד סיפור קצר על שניכם - כל אחד מוסיף משפט אחד', 'Tell a short story together about the two of you - each adds one sentence', true),
    (g_id, 'create_together', 'light', 'צרו ביחד רשימת השמעה ''שלנו'' של 10 שירים - כל אחד מוסיף 5', 'Create together ''our playlist'' of 10 songs - each adds 5', true),
    (g_id, 'create_together', 'light', 'עצבו ביחד ארוחת בוקר מושלמת - מה יש עליה? ציירו אותה', 'Design together the perfect breakfast - what''s on it? Draw it', true),
    (g_id, 'create_together', 'light', 'המציאו שם לזוג שלכם - ועצבו ''לוגו'' על נייר', 'Invent a name for your couple - and design a ''logo'' on paper', true),
    (g_id, 'create_together', 'light', 'כתבו ביחד ''מניפסט הזוג'' - 5 ערכים שהכי חשובים לכם', 'Write together a ''couple manifesto'' - 5 values most important to you', true),
    (g_id, 'mini_adventure', 'flirty', 'יצאו עכשיו לחוץ למשך 10 דקות - מצאו משהו יפה ושתפו', 'Go outside right now for 10 minutes - find something beautiful and share it', true),
    (g_id, 'mini_adventure', 'flirty', 'בחרו אקראית עיר/מקום במפה - תכננו חופשה דמיונית שם', 'Randomly choose a city/place on a map - plan an imaginary vacation there', true),
    (g_id, 'mini_adventure', 'flirty', 'עשו דבר אחד שלא עשיתם ביחד מעולם - בתוך הבית', 'Do one thing together you''ve never done before - inside the house', true),
    (g_id, 'mini_adventure', 'flirty', 'ספרו ביחד את 5 ההרפתקאות הכי גדולות שחלמתם לעשות', 'List together the 5 biggest adventures you''ve dreamed of doing', true),
    (g_id, 'mini_adventure', 'flirty', 'קבעו ''רנדומלי'' יציאה לאחר שבוע - לאן שהאצבע תצביע במפה', 'Set a ''random'' outing for next week - wherever your finger points on the map', true),
    (g_id, 'mini_adventure', 'flirty', 'ספרו על ההרפתקה הכי טובה שהיתה לכם ביחד - עם פרטים', 'Tell about the best adventure you''ve had together - with details', true),
    (g_id, 'mini_adventure', 'flirty', 'תכנן/י הפתעה קטנה לצד השני לשבוע הבא - ותרמוז על מה זה', 'Plan a small surprise for your partner for next week - and hint what it is', true),
    (g_id, 'mini_adventure', 'flirty', 'המציאו ''חוקי ערב המשחק שלנו'' - 3 חוקים מגוחכים שיחייבו אתכם', 'Invent ''our game night rules'' - 3 silly rules that will bind you', true),
    (g_id, 'bucket_item', 'deep', 'כל אחד אומר דבר אחד מרשימת החלומות שלו שרוצה לממש ב-5 שנים', 'Each says one thing from their bucket list they want to fulfill in 5 years', true),
    (g_id, 'bucket_item', 'deep', 'מה חוויה אחת שאתם רוצים לחיות ביחד לפחות פעם אחת?', 'What''s one experience you want to live together at least once?', true),
    (g_id, 'bucket_item', 'deep', 'ספרו ביחד 3 מקומות שאתם רוצים לראות לפני שתמות', 'List together 3 places you want to see before you die', true),
    (g_id, 'bucket_item', 'deep', 'מה הדבר שאתה/ת חושש/ת שלא תספיק/י לעשות ורוצה/ת שיקרה?', 'What''s something you''re afraid you won''t have time to do and want to happen?', true),
    (g_id, 'bucket_item', 'deep', 'תכננו ביחד ''שנת חלום'' - איך היא נראית?', 'Plan together a ''dream year'' - what does it look like?', true),
    (g_id, 'bucket_item', 'deep', 'כל אחד כותב 3 חלומות על נייר - מחליפים ומגיבים', 'Each writes 3 dreams on paper - swap and respond', true),
    (g_id, 'bucket_item', 'deep', 'מה הדבר שאתם רוצים לעשות ביחד ועדיין לא מצאתם זמן?', 'What''s something you want to do together and still haven''t found time for?', true),
    (g_id, 'bucket_item', 'deep', 'בחרו יחד ''פרויקט ביחד'' שתתחילו בחודש הקרוב - ומה זה?', 'Choose together a ''together project'' to start next month - and what is it?', true),
    (g_id, 'fun_challenge', 'light', 'מי יצליח לאזן עיפרון על האף זמן רב יותר? 3 ניסיונות', 'Who can balance a pencil on their nose longer? 3 attempts each', true),
    (g_id, 'fun_challenge', 'light', 'חבקו ביחד קלפים - בלי ידיים - 30 שניות. פילו נפל? מתחילים שוב', 'Hold playing cards together - without hands - 30 seconds. Card fell? Start over', true),
    (g_id, 'fun_challenge', 'light', 'כל אחד מנסה לחקות את הצד השני בשיר - בלי להגיד מה השיר', 'Each tries to imitate the other humming a song - without saying what the song is', true),
    (g_id, 'fun_challenge', 'light', 'מי יצליח להגיד את האלפבית בעברית הכי מהר? מתחרים', 'Who can say the Hebrew alphabet fastest? Compete', true),
    (g_id, 'fun_challenge', 'light', 'כתבו 60 שניות כמה שיותר ''תכונות טובות'' זה על זה - מחליפים', 'Write for 60 seconds as many ''good qualities'' about each other as possible - then swap', true),
    (g_id, 'fun_challenge', 'light', 'שחקו ''מה יש בתיק?'' - כל אחד מוציא פריט ומספר מדוע הוא שם', 'Play ''what''s in the bag?'' - each takes out one item and explains why it''s there', true),
    (g_id, 'fun_challenge', 'light', 'מי יכול לזכור יותר פרטים מהפגישה הראשונה שלכם? בדקו', 'Who can remember more details from your first meeting? Test each other', true),
    (g_id, 'fun_challenge', 'light', 'כל אחד מתחיל משפט ב''אנחנו תמיד...'' - והשני מסיים אחרת', 'Each starts a sentence with ''We always...'' - and the other finishes it differently', true),
    (g_id, 'plan_dream', 'deep', 'תכנן/י ביחד חופשה חלומית ב-10 דקות - יעד, לינה, פעילות אחת', 'Plan together a dream vacation in 10 minutes - destination, accommodation, one activity', true),
    (g_id, 'plan_dream', 'deep', 'מה הפרויקט האישי שכל אחד מכם רוצה לממש השנה - ואיך תתמכו?', 'What''s the personal project each of you wants to fulfill this year - and how will you support it?', true),
    (g_id, 'plan_dream', 'deep', 'ספרו מה ''הערב המושלם ביחד'' נראה עבורכם - פרטים קטנים', 'Tell what the ''perfect evening together'' looks like - small details', true),
    (g_id, 'plan_dream', 'deep', 'מה מנהג חדש אחד שתרצו להוסיף לחיים שלכם ביחד?', 'What new routine would you want to add to your life together?', true),
    (g_id, 'plan_dream', 'deep', 'תכננו ''יום ספונטני'' שיקרה בחודש הקרוב - בלי מבנה מראש', 'Plan a ''spontaneous day'' to happen next month - with no pre-set structure', true),
    (g_id, 'plan_dream', 'deep', 'מה הדבר שאם הייתם עושים יותר - הקשר שלכם היה מרגיש טוב יותר?', 'What''s something that if you did more - your relationship would feel better?', true),
    (g_id, 'plan_dream', 'deep', 'בנו יחד ''לו"ז חלומי'' לשבת הקרובה - גם אם לא ריאלי', 'Build together a ''dream schedule'' for next Saturday - even if unrealistic', true),
    (g_id, 'plan_dream', 'deep', 'מה מטרה זוגית אחת שתרצו להשיג ב-6 חודשים הקרובים?', 'What''s one couple goal you want to achieve in the next 6 months?', true);

END;
$$;

-- ────────────────────────────────────────────
-- GAME: שיא המיניות 🔥 (peak-desire-spin)
-- ────────────────────────────────────────────
DO $$
DECLARE
  g_id uuid;
BEGIN

  INSERT INTO public.games
    (name_he, name_en, description_he, description_en, slug,
     is_active, bg_type, bg_value, player_mode)
  VALUES (
    'שיא המיניות 🔥',
    'Peak Desire 🔥',
    'למבוגרים - פנטזיות נועזות, גוף, תפקידים, תשוקה ואתגרים לוהטים שמרימים את הטמפרטורה.',
    'For adults - bold fantasies, body, roleplay, desire and hot challenges that raise the temperature.',
    'peak-desire-spin',
    true, 'color', '#0a0000', false
  )
  ON CONFLICT (slug) DO UPDATE SET
    name_he = 'שיא המיניות 🔥',
    name_en = 'Peak Desire 🔥',
    description_he = 'למבוגרים - פנטזיות נועזות, גוף, תפקידים, תשוקה ואתגרים לוהטים שמרימים את הטמפרטורה.',
    description_en = 'For adults - bold fantasies, body, roleplay, desire and hot challenges that raise the temperature.',
    bg_type = 'color',
    bg_value = '#0a0000'
  RETURNING id INTO g_id;

  INSERT INTO public.wheel_configs
    (game_id, slices, pointer_color, inner_circle,
     inner_circle_color, inner_circle_border_color, border_color,
     divider_color, divider_enabled, divider_width,
     marker_config, category_colors, player_config)
  VALUES (
    g_id,
    '[{"id": "slice-fantasy_bold-0", "label_he": "🔥 פנטזיה", "label_en": "🔥 Fantasy", "color": "#B71C1C", "question_type": "fantasy_bold"}, {"id": "slice-body_game-0", "label_he": "💫 גוף", "label_en": "💫 Body", "color": "#880E4F", "question_type": "body_game"}, {"id": "slice-roleplay_now-0", "label_he": "🎭 תפקידים", "label_en": "🎭 Roleplay", "color": "#4A148C", "question_type": "roleplay_now"}, {"id": "slice-desire_reveal-0", "label_he": "🌹 תשוקה", "label_en": "🌹 Desire", "color": "#BF360C", "question_type": "desire_reveal"}, {"id": "slice-hot_dare-0", "label_he": "⚡ אתגר לוהט", "label_en": "⚡ Hot Dare", "color": "#827717", "question_type": "hot_dare"}, {"id": "slice-fantasy_bold-1", "label_he": "🔥 פנטזיה", "label_en": "🔥 Fantasy", "color": "#B71C1C", "question_type": "fantasy_bold"}, {"id": "slice-body_game-1", "label_he": "💫 גוף", "label_en": "💫 Body", "color": "#880E4F", "question_type": "body_game"}, {"id": "slice-roleplay_now-1", "label_he": "🎭 תפקידים", "label_en": "🎭 Roleplay", "color": "#4A148C", "question_type": "roleplay_now"}, {"id": "slice-desire_reveal-1", "label_he": "🌹 תשוקה", "label_en": "🌹 Desire", "color": "#BF360C", "question_type": "desire_reveal"}, {"id": "slice-hot_dare-1", "label_he": "⚡ אתגר לוהט", "label_en": "⚡ Hot Dare", "color": "#827717", "question_type": "hot_dare"}]'::jsonb,
    '#ffffff', true, '#1a1a2e', '#ffffff', '#ffffff',
    '#ffffff', true, 2,
    '{"marker_type": "none", "marker_color": "#ffffff", "marker_size": 8, "marker_count": 0, "marker_position": 0}'::jsonb,
    '{"fantasy_bold": "#B71C1C", "body_game": "#880E4F", "roleplay_now": "#4A148C", "desire_reveal": "#BF360C", "hot_dare": "#827717"}'::jsonb,
    '{"desired_total_slices": 10, "categories": [{"id": "cat-fantasy_bold", "key": "fantasy_bold", "label_he": "🔥 פנטזיה", "label_en": "🔥 Fantasy", "color": "#B71C1C"}, {"id": "cat-body_game", "key": "body_game", "label_he": "💫 גוף", "label_en": "💫 Body", "color": "#880E4F"}, {"id": "cat-roleplay_now", "key": "roleplay_now", "label_he": "🎭 תפקידים", "label_en": "🎭 Roleplay", "color": "#4A148C"}, {"id": "cat-desire_reveal", "key": "desire_reveal", "label_he": "🌹 תשוקה", "label_en": "🌹 Desire", "color": "#BF360C"}, {"id": "cat-hot_dare", "key": "hot_dare", "label_he": "⚡ אתגר לוהט", "label_en": "⚡ Hot Dare", "color": "#827717"}], "player_repetitions": 8}'::jsonb
  )
  ON CONFLICT (game_id) DO UPDATE SET
    slices = EXCLUDED.slices,
    category_colors = EXCLUDED.category_colors,
    player_config = EXCLUDED.player_config;

  -- Delete existing questions for this game (clean re-seed)
  DELETE FROM public.questions WHERE game_id = g_id;

  INSERT INTO public.questions
    (game_id, type, level, text_he, text_en, is_active)
  VALUES
    (g_id, 'fantasy_bold', 'deep', 'ספר/י פנטזיה אחת שעדיין לא סיפרת לאף אחד - ושתף/י את הצד השני', 'Tell a fantasy you''ve never told anyone - and share it with your partner', true),
    (g_id, 'fantasy_bold', 'deep', 'מה התרחיש שאם הצד השני היה מציע - לא היית אומר/ת לא?', 'What scenario, if your partner proposed, you wouldn''t say no to?', true),
    (g_id, 'fantasy_bold', 'deep', 'תאר/י את הבוקר המושלם שאחרי הלילה המושלם - פרטים חושניים', 'Describe the perfect morning after the perfect night - sensual details', true),
    (g_id, 'fantasy_bold', 'deep', 'מה הפנטזיה שהכי מביכה אותך לספר - ועדיין תספר/י?', 'What''s the fantasy most embarrassing to tell - and you''ll tell it anyway?', true),
    (g_id, 'fantasy_bold', 'deep', 'מה הסצנה מסרט/ספר שמצאת הכי מגרה/ת - ולמה?', 'What scene from a movie/book did you find most arousing - and why?', true),
    (g_id, 'fantasy_bold', 'deep', 'ספר/י על פנטזיית מיקום - איפה הכי תרצה/י שזה יקרה?', 'Tell about a location fantasy - where would you most want it to happen?', true),
    (g_id, 'fantasy_bold', 'deep', 'מה הפנטזיית לבוש שלך - מה הצד השני לובש/ת שמשגע/ת אותך?', 'What''s your outfit fantasy - what does your partner wear that drives you crazy?', true),
    (g_id, 'fantasy_bold', 'deep', 'ספר/י על פנטזיית כוח - מי מוביל, מי נוהל - ואיך זה נראה?', 'Tell about a power fantasy - who leads, who follows - and what it looks like?', true),
    (g_id, 'fantasy_bold', 'deep', 'מה הזמן ביום שהכי מתאים לאינטימיות - ולמה?', 'What time of day is best for intimacy - and why?', true),
    (g_id, 'fantasy_bold', 'deep', 'תאר/י את הנשיקה המושלמת מנקודת מבטך - כל פרט', 'Describe the perfect kiss from your perspective - every detail', true),
    (g_id, 'body_game', 'flirty', 'כסה/י עיניים של הצד השני ועבור/י בעדינות על הפנים שלהם בקצות אצבעותיך', 'Cover the other''s eyes and gently trace their face with your fingertips', true),
    (g_id, 'body_game', 'flirty', 'ספר/י לצד השני בפרטים: מה הנקודות שהכי נהנים שנוגעים בהן?', 'Tell your partner in detail: what spots do you most enjoy being touched?', true),
    (g_id, 'body_game', 'flirty', 'עסה/י ביד אחת את צוואר הצד השני בעדינות - 3 דקות, בשתיקה', 'Massage the other''s neck with one hand gently - 3 minutes, in silence', true),
    (g_id, 'body_game', 'flirty', 'כסה/י עיניים ותן/י לצד השני לנחש מה אתה/ת עושה/ת - בנגיעות בלבד', 'Cover eyes and let your partner guess what you''re doing - only through touch', true),
    (g_id, 'body_game', 'flirty', 'עבור/י בשפתיים בעדינות על הכתף של הצד השני - ותאר/י את ההרגשה', 'Move your lips gently along your partner''s shoulder - and describe the feeling', true),
    (g_id, 'body_game', 'flirty', 'שכבו זה על גבי זה - 2 דקות בשתיקה מלאה - ופשוט הרגישו', 'Lie one on top of the other - 2 minutes in complete silence - and just feel', true),
    (g_id, 'body_game', 'flirty', 'מה המגע שהכי מדליק אותך? הראה/י לצד השני איפה ואיך בדיוק', 'What touch most arouses you? Show your partner where and how exactly', true),
    (g_id, 'body_game', 'flirty', 'כסה/י עיניים - הצד השני נוגע בנקודה אחת בגוף - נחש/י איפה', 'Cover eyes - partner touches one point on your body - guess where', true),
    (g_id, 'body_game', 'flirty', 'ספר/י לצד השני מה הם עושים בזמן נגיעה שמרגיש לך הכי טוב', 'Tell your partner what they do during touch that feels best to you', true),
    (g_id, 'body_game', 'flirty', 'תאר/י את התחושה הגופנית שאתה/ת אוהב/ת בזמן קרבה - במילים', 'Describe the physical sensation you love during closeness - in words', true),
    (g_id, 'roleplay_now', 'flirty', 'בחרו תרחיש: ''פגישה ראשונה במסעדה יוקרתית'' - ושחקו 5 דקות', 'Choose the scenario: ''First meeting at a luxury restaurant'' - and play for 5 min', true),
    (g_id, 'roleplay_now', 'flirty', 'כל אחד לובש ''דמות'' שונה מעצמו - ומנהלים שיחה שלא תוכלו לנהל בדרך כלל', 'Each takes on a character different from themselves - have a conversation you usually can''t', true),
    (g_id, 'roleplay_now', 'flirty', 'תרחיש: ''זרים ברכבת לילה'' - מי מתחיל? 5 דקות', 'Scenario: ''Strangers on a night train'' - who starts? 5 minutes', true),
    (g_id, 'roleplay_now', 'flirty', 'כל אחד כותב ''תפקיד'' שיה/יה רוצה שהצד השני ישחק - ומחליפים', 'Each writes a ''role'' they want their partner to play - then swap', true),
    (g_id, 'roleplay_now', 'flirty', 'שחקו ''ראיון עבודה'' - אחד מראיין, אחד מועמד - לתפקיד מגרה', 'Play ''job interview'' - one interviews, one is candidate - for an arousing role', true),
    (g_id, 'roleplay_now', 'flirty', 'תרחיש: ''חדר מלון בעיר זרה'' - שניכם נפגשים שם לראשונה - ושחקו', 'Scenario: ''Hotel room in a foreign city'' - you meet there for the first time - play', true),
    (g_id, 'roleplay_now', 'flirty', 'כל אחד בוחר שם בדוי לעצמו לרבע שעה - ומדברים כמו הדמויות האלה', 'Each chooses a fake name for 15 minutes - and speaks as those characters', true),
    (g_id, 'roleplay_now', 'flirty', 'שחקו ''מי מנהיג?'' - ל-10 דקות כל אחד מוביל - מחליפים', 'Play ''who leads?'' - for 10 minutes each leads - then switch', true),
    (g_id, 'desire_reveal', 'deep', 'מה הדבר שהצד השני עושה שמדליק אותך יותר מכל דבר אחר?', 'What does your partner do that arouses you more than anything else?', true),
    (g_id, 'desire_reveal', 'deep', 'ספר/י מה הזמן שהרגשת הכי תשוקה - ומה גרם לזה?', 'Tell about the time you felt the most desire - and what caused it?', true),
    (g_id, 'desire_reveal', 'deep', 'מה ''הקוד הסודי'' שרק הצד השני יודע - דבר שמוביל אותך לרצות?', 'What''s the ''secret code'' only your partner knows - something that leads you to desire?', true),
    (g_id, 'desire_reveal', 'deep', 'מה הדבר שאתה/ת רוצה שהצד השני יעשה יותר?', 'What do you want your partner to do more of?', true),
    (g_id, 'desire_reveal', 'deep', 'ספר/י על הרגע שהכי הרגשת תשוקה אחד לשני - מה קדם לו?', 'Tell about the moment you felt the most desire for each other - what preceded it?', true),
    (g_id, 'desire_reveal', 'deep', 'מה הדבר שאתה/ת ביישן/ת לבקש ואתה/ת רוצה/ת?', 'What''s something you''re shy to ask for and you want?', true),
    (g_id, 'desire_reveal', 'deep', 'ספר/י: ''מה גורם לי להרגיש הכי נחשק/ת ואהוב/ה הוא...''', 'Tell: ''What makes me feel most desired and loved is...''', true),
    (g_id, 'desire_reveal', 'deep', 'מה הדבר שאתה/ת רוצה לנסות בפעם הבאה שלא ניסיתם?', 'What''s something you want to try next time that you haven''t tried?', true),
    (g_id, 'desire_reveal', 'deep', 'מה ''הרגע המיני'' שאם היה קורה עוד היום - לא היית מתנגד/ת?', 'What ''intimate moment'' if it happened today - you wouldn''t resist?', true),
    (g_id, 'hot_dare', 'flirty', 'לאט ובעיניים עצומות - נשקו 60 שניות מלאות - בלי לפסוק', 'Slowly with closed eyes - kiss for 60 full seconds - without stopping', true),
    (g_id, 'hot_dare', 'flirty', 'ספר/י לצד השני 3 דברים שאתה/ת עושה להם שהם אוהבים - ושאל/י: נכון?', 'Tell your partner 3 things you do to them they love - and ask: right?', true),
    (g_id, 'hot_dare', 'flirty', 'כסה/י עיניים - הצד השני מביא 2 עצמים - נחש/י מה הם ועל מה הם מרמזים', 'Cover eyes - partner brings 2 objects - guess what they are and what they hint at', true),
    (g_id, 'hot_dare', 'flirty', 'כתבו ביחד: ''הלילה הכי טוב שנהיה לנו יהיה כשנ...'' - ומשלימים', 'Write together: ''Our best night will be when we...'' - and complete it', true),
    (g_id, 'hot_dare', 'flirty', 'האחד יוביל ריקוד איטי של 3 דקות - בלי מוזיקה - רק גוף ותנועה', 'One leads a slow dance for 3 minutes - without music - only body and movement', true),
    (g_id, 'hot_dare', 'flirty', 'כל אחד מקריב ''גזר דין'' לוהט - מה הצד השני צריך לעשות עכשיו?', 'Each delivers a ''hot verdict'' - what does the other person have to do right now?', true),
    (g_id, 'hot_dare', 'flirty', 'שחקו ''מה אני מרגיש?'' - נגיעה אחת, עיניים עצומות, ניחוש', 'Play ''what do I feel?'' - one touch, eyes closed, guess', true),
    (g_id, 'hot_dare', 'flirty', 'ספרו ביחד בתורות - ''אחד הדברים שהכי מושכים אותי בך הוא...'' - ל-5 סיבובים', 'Take turns saying - ''One thing most attractive about you is...'' - for 5 rounds', true);

END;
$$;

-- =====================================================
-- Seed complete.
-- Total games: 7
-- Total questions: 289
-- =====================================================