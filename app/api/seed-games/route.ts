/**
 * TEMPORARY seed route — DELETE after use.
 * GET /api/seed-games  → inserts all 7 wheel games + questions.
 */
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function makeSlices(categories: {key:string;label_he:string;label_en:string;color:string}[]) {
  const slices = [];
  for (let i = 0; i < 2; i++) {
    for (const cat of categories) {
      slices.push({ id:`slice-${cat.key}-${i}`, label_he:cat.label_he, label_en:cat.label_en, color:cat.color, question_type:cat.key });
    }
  }
  return slices;
}
function makePlayerConfig(categories: {key:string;label_he:string;label_en:string;color:string}[]) {
  return { desired_total_slices:10, categories:categories.map(c=>({id:`cat-${c.key}`,key:c.key,label_he:c.label_he,label_en:c.label_en,color:c.color})), player_repetitions:8 };
}
function makeCategoryColors(categories: {key:string;color:string}[]) {
  return Object.fromEntries(categories.map(c=>[c.key,c.color]));
}

const MARKER_CONFIG = { marker_type:"none", marker_color:"#ffffff", marker_size:8, marker_count:0, marker_position:0 };

const GAMES = [
  // ── 1. פגישה ראשונה ─────────────────────────────────────────────
  { name_he:"פגישה ראשונה", name_en:"First Date Wheel",
    desc_he:"גלגל המשחק המושלם לדייט ראשון — שוברי קרח, סקרנות, אתגרים כיפיים וגילויים מפתיעים.",
    desc_en:"The perfect wheel game for a first date — ice breakers, curiosity, fun dares and surprising discoveries.",
    slug:"first-date-spin", bg_value:"#1a0a2e",
    cats:[
      {key:"icebreaker", label_he:"🧊 שוברי קרח",  label_en:"🧊 Ice Breakers",     color:"#FF6B9D"},
      {key:"curiosity",  label_he:"💭 מי אתה?",    label_en:"💭 Who Are You?",      color:"#FF8E53"},
      {key:"dare_fun",   label_he:"😄 אתגר כיפי",  label_en:"😄 Fun Dare",          color:"#C77DFF"},
      {key:"dreamwish",  label_he:"✨ חלומות",      label_en:"✨ Dreams",             color:"#FFD700"},
      {key:"wouldyou",   label_he:"🎲 מה תעדיף?",  label_en:"🎲 Would You Rather?", color:"#4FC3F7"},
    ],
    qs:[
      {t:"icebreaker",l:"light",he:"ספר משהו מצחיק שקרה לך השבוע — קטן ככל שיהיה",en:"Tell something funny that happened to you this week — however small"},
      {t:"icebreaker",l:"light",he:"מה הדבר הכי מוזר שאכלת בחיים שלך?",en:"What's the strangest thing you've ever eaten in your life?"},
      {t:"icebreaker",l:"light",he:"שיר אחד שאתה יודע בעל פה — שר 10 שניות עכשיו",en:"One song you know by heart — sing 10 seconds right now"},
      {t:"icebreaker",l:"light",he:"מה הכינוי שהיה לך בילדות ומאיפה הוא הגיע?",en:"What nickname did you have as a child and where did it come from?"},
      {t:"icebreaker",l:"light",he:"גלה הרגל מוזר אחד שלך שרוב האנשים לא יודעים עליו",en:"Reveal one weird habit of yours that most people don't know"},
      {t:"icebreaker",l:"light",he:"מה הסרט שראית הכי הרבה פעמים בחיים?",en:"What movie have you watched the most times in your life?"},
      {t:"icebreaker",l:"light",he:"ספר עובדה מפתיעה אחת על עצמך שהאחר בטח לא מנחש",en:"Tell one surprising fact about yourself the other can't guess"},
      {t:"icebreaker",l:"light",he:"עשה את הקול החייתי הכי מדויק שאתה יכול — 5 שניות",en:"Make the most accurate animal sound you can — 5 seconds"},
      {t:"icebreaker",l:"light",he:"מה הייתה ה-phase האומנותית הכי מביכה שלך בגיל 14?",en:"What was your most embarrassing artistic phase at age 14?"},
      {t:"curiosity",l:"flirty",he:"מה הדבר הראשון שמשך אותך אליי כשנפגשנו?",en:"What first attracted you to me when we met?"},
      {t:"curiosity",l:"flirty",he:"תאר את הדייט האידיאלי שלך — פרטים קטנים ספציפיים!",en:"Describe your ideal date — specific small details!"},
      {t:"curiosity",l:"flirty",he:"מה הדבר שהכי הפתיע אותך אצלי עד כה?",en:"What surprised you most about me so far?"},
      {t:"curiosity",l:"flirty",he:"מה הרגשת כשראית אותי בפעם הראשונה? תהיה כנה",en:"What did you feel when you saw me for the first time? Be honest"},
      {t:"curiosity",l:"flirty",he:"מה חשוב לך יותר ביחסים — פיזי או רגשי? למה?",en:"What matters more to you in a relationship — physical or emotional? Why?"},
      {t:"curiosity",l:"flirty",he:"מה מביך אותך מהר ומה גורם לך להיפתח לאדם?",en:"What embarrasses you quickly and what makes you open up to someone?"},
      {t:"curiosity",l:"flirty",he:"מהי החוויה האדרנלינית הכי גדולה שעברת? רצית לחזור?",en:"What's the biggest adrenaline experience you've had? Did you want to repeat it?"},
      {t:"curiosity",l:"flirty",he:"מה בן/בת הזוג האידיאלי שלך חייב/ת שיהיה לו/לה? דבר אחד",en:"What must your ideal partner have? One thing only"},
      {t:"curiosity",l:"flirty",he:"ספר לי על רגע שחשבת שמישהו מיוחד נכנס לחיים שלך",en:"Tell me about a moment you thought someone special was entering your life"},
      {t:"dare_fun",l:"light",he:"שלח הודעת קול לחבר עם בדיחה שאתה ממציא ברגע זה",en:"Send a voice message to a friend with a joke you invent right now"},
      {t:"dare_fun",l:"light",he:"עשה ריקוד של 15 שניות לשיר שהצד השני בוחר עבורך",en:"Do a 15-second dance to a song the other person picks for you"},
      {t:"dare_fun",l:"light",he:"חקה את הצד השני — הליכה, מחווה, ביטוי — בדיוק רב ככל שתוכל",en:"Imitate the other person — walk, gesture, expression — as accurately as you can"},
      {t:"dare_fun",l:"light",he:"בלי להשתמש בידיים — אכול משהו מהשולחן",en:"Without using your hands — eat something from the table"},
      {t:"dare_fun",l:"light",he:"תאר את הצד השני כסוג של פיצה — מה הרכיבים?",en:"Describe the other person as a type of pizza — what are the toppings?"},
      {t:"dare_fun",l:"light",he:"ספר בדיחה שאתה בטוח 100% שהאחר ישחק עליה",en:"Tell a joke you're 100% sure the other will laugh at"},
      {t:"dare_fun",l:"light",he:"שלח אמוג׳י שמסכם את הדייט הזה עד עכשיו — ואסביר למה",en:"Send an emoji that sums up this date so far — and explain why you chose it"},
      {t:"dare_fun",l:"light",he:"עשה מחמאה לצד השני — בלי להשתמש במילה יפה או נחמד",en:"Give the other a compliment — without using the word beautiful or nice"},
      {t:"dreamwish",l:"deep",he:"מה דבר אחד שאתה רוצה לחוות לפחות פעם אחת בחיים?",en:"What's one thing you want to experience at least once in life?"},
      {t:"dreamwish",l:"deep",he:"אם כסף לא היה גורם — מה היית עושה עם הזמן שלך?",en:"If money wasn't a factor — what would you do with your time?"},
      {t:"dreamwish",l:"deep",he:"מה הדבר שאתה הכי גאה בו — שאחרים לא בהכרח יודעים?",en:"What are you most proud of — that others may not know?"},
      {t:"dreamwish",l:"deep",he:"לאיזה מקום בעולם תרצה לגור שנה שלמה ולמה?",en:"Which place in the world would you want to live for a whole year and why?"},
      {t:"dreamwish",l:"deep",he:"מה חלום שעדיין לא הגשמת אבל עדיין לא ויתרת עליו?",en:"What's a dream you haven't fulfilled yet but haven't given up on?"},
      {t:"dreamwish",l:"deep",he:"תאר את הבוקר המושלם שלך בחיי החלום — כל פרט",en:"Describe your perfect morning in your dream life — every detail"},
      {t:"dreamwish",l:"deep",he:"מה הדבר שפחדת ממנו ועשית בכל זאת — ומה הרגשת אחרי?",en:"What's something you were afraid of and did anyway — and how did you feel after?"},
      {t:"dreamwish",l:"deep",he:"אם תוכל ללמד דבר אחד לכל בני האדם — מה זה יהיה?",en:"If you could teach one thing to all humanity — what would it be?"},
      {t:"wouldyou",l:"flirty",he:"יציאה לים בלילה עם מוזיקה בשקט, או טיול הרים עם שתיקה מלאה?",en:"A late-night beach with quiet music, or a mountain hike in complete silence?"},
      {t:"wouldyou",l:"flirty",he:"חיבוק ארוך בלי מילים, או שיחה עמוקה עד שעות הלילה?",en:"A long hug without words, or a deep conversation until late at night?"},
      {t:"wouldyou",l:"flirty",he:"לדעת מה הצד השני חושב עליך כרגע, או לשמור על המסתורין?",en:"Know what the other person thinks of you right now, or keep the mystery?"},
      {t:"wouldyou",l:"flirty",he:"לקבל פרח אחד בהפתעה, או זר גדול בתאריך ידוע?",en:"Receive one surprise flower, or a big bouquet on a known date?"},
      {t:"wouldyou",l:"flirty",he:"לצאת לדייט מתוכנן לפרטים הקטנים, או הרפתקה ספונטנית לגמרי?",en:"Go on a meticulously planned date, or a completely spontaneous adventure?"},
      {t:"wouldyou",l:"flirty",he:"לשמוע אני אוהב אותך פעם אחת מכל הלב, או לשמוע את זה בכל יום בקצרה?",en:"Hear I love you once with full heart, or hear it briefly every day?"},
      {t:"wouldyou",l:"flirty",he:"לבלות שבוע בלי טלפון עם אדם מיוחד, או שבוע לבד עם הטלפון?",en:"Spend a week without phone with someone special, or a week alone with your phone?"},
      {t:"wouldyou",l:"flirty",he:"שיבנה קשר אט אט ובטוח, או כימיה סוחפת מהרגע הראשון?",en:"Build a relationship slowly and securely, or overwhelming chemistry from the first moment?"},
    ]
  },
  // ── 2. זוגיות בלב ────────────────────────────────────────────────
  { name_he:"זוגיות בלב", name_en:"Couple Heart Wheel",
    desc_he:"לזוגות שרוצים להתחבר עמוק יותר — הוקרה, זיכרונות משותפים, שיחות עומק ואתגרי זוג.",
    desc_en:"For couples who want to connect deeper — appreciation, shared memories, deep talks and couple dares.",
    slug:"couple-heart-spin", bg_value:"#1a0010",
    cats:[
      {key:"appreciation",label_he:"💕 הוקרה",     label_en:"💕 Appreciation",   color:"#E91E63"},
      {key:"deep_connect",label_he:"🔍 עומק",       label_en:"🔍 Deep Connect",   color:"#9C27B0"},
      {key:"memory",      label_he:"📸 זיכרון",    label_en:"📸 Memory",          color:"#F44336"},
      {key:"couple_dare", label_he:"🎯 אתגר זוגי", label_en:"🎯 Couple Dare",    color:"#FF5722"},
      {key:"future",      label_he:"🌟 עתיד ביחד", label_en:"🌟 Future Together", color:"#FF9800"},
    ],
    qs:[
      {t:"appreciation",l:"light",he:"אמור לבן/בת זוגך דבר אחד שגורם לך להרגיש בטוח/ה",en:"Tell your partner one thing they do that makes you feel safe"},
      {t:"appreciation",l:"light",he:"מה הדבר שהכי אהבת שעשו בשבוע האחרון?",en:"What did you love most that they did in the past week?"},
      {t:"appreciation",l:"light",he:"ספר איך הם גרמו לך להרגיש אהוב/ה לאחרונה — בפרט ספציפי",en:"Tell how they made you feel loved recently — one specific detail"},
      {t:"appreciation",l:"light",he:"מה הסגולה שלהם שלדעתך לא מספיק מוערכת?",en:"What quality of theirs do you think isn't appreciated enough?"},
      {t:"appreciation",l:"light",he:"שלח הודעת קול עם מחמאה אמיתית לבן/בת הזוג עכשיו",en:"Send a voice message with a genuine compliment to your partner right now"},
      {t:"appreciation",l:"light",he:"מה הדבר שהכי שמח אותך בקשר שלכם ב-3 חודשים האחרונים?",en:"What made you happiest about your relationship in the last 3 months?"},
      {t:"appreciation",l:"light",he:"גע ביד הצד השני ואמור 3 דברים שמיוחדים בו/בה",en:"Touch the other's hand and say 3 things that are special about them"},
      {t:"appreciation",l:"light",he:"מה הזכרון הכי חם שיש לך מביחד שלכם?",en:"What's the warmest memory you have from being together?"},
      {t:"appreciation",l:"light",he:"ספר על רגע שהם הפתיעו אותך לטובה — ומה הרגשת",en:"Tell about a moment they positively surprised you — and what you felt"},
      {t:"deep_connect",l:"deep",he:"מה הפחד הכי גדול שלך בקשר הזה שמעולם לא אמרת בקול?",en:"What's your biggest fear in this relationship that you've never said aloud?"},
      {t:"deep_connect",l:"deep",he:"אם הייתה יכול/ה לשנות דבר אחד בדרך שאתה/את מתקשר/ת — מה זה?",en:"If you could change one thing about how you communicate — what would it be?"},
      {t:"deep_connect",l:"deep",he:"מה הצורך הרגשי שלך שאינו תמיד מתמלא?",en:"What emotional need do you feel isn't always met?"},
      {t:"deep_connect",l:"deep",he:"ספר על רגע שהרגשת הכי קרוב/ה לבן/בת הזוג שלך",en:"Tell about a moment you felt closest to your partner"},
      {t:"deep_connect",l:"deep",he:"מה הדבר שהכי קשה לך להגיד לבן/בת הזוג שלך — ולמה?",en:"What's the hardest thing for you to say to your partner — and why?"},
      {t:"deep_connect",l:"deep",he:"אם הקשר שלכם היה ספר — מה הפרק שנמצא עכשיו?",en:"If your relationship were a book — what chapter are you in right now?"},
      {t:"deep_connect",l:"deep",he:"מה היה השינוי הכי גדול בך מאז שנכנסת לקשר הזה?",en:"What's the biggest change in you since entering this relationship?"},
      {t:"deep_connect",l:"deep",he:"אם יכולת לחזור לרגע אחד ביחד ולחיות אותו מחדש — מה זה?",en:"If you could relive one moment together — what would it be?"},
      {t:"deep_connect",l:"deep",he:"מה מעניין אותך לגלות עוד על הצד השני שעדיין לא ידוע לך?",en:"What are you curious to discover about your partner that you don't know yet?"},
      {t:"memory",l:"flirty",he:"ספר את הרגע הראשון שהרגשת שזה משהו מיוחד ביניכם",en:"Tell about the first moment you felt this was something special between you"},
      {t:"memory",l:"flirty",he:"מה היה הצחוק הכי גדול שלכם ביחד? חיקוי או ספר מחדש",en:"What was your biggest laugh together? Re-enact or retell it"},
      {t:"memory",l:"flirty",he:"ספר על ויכוח שסיים בצחוק — ולמה זה הפך ליפה",en:"Tell about an argument that ended in laughter — and why it became beautiful"},
      {t:"memory",l:"flirty",he:"מה הרגע שהכי שמחת שהמצלמה לא הייתה שם?",en:"What moment are you most glad the camera wasn't there?"},
      {t:"memory",l:"flirty",he:"ספר על פעם שהיית גאה בבן/בת הזוג שלך בפני אחרים",en:"Tell about a time you were proud of your partner in front of others"},
      {t:"memory",l:"flirty",he:"מה הדבר הכי ספונטני שעשיתם ביחד שלא תכננתם?",en:"What's the most spontaneous thing you did together that wasn't planned?"},
      {t:"memory",l:"flirty",he:"ספר על רגע שהסתכלתם אחד על השני ובלי מילים הכול היה ברור",en:"Tell about a moment you looked at each other and without words everything was clear"},
      {t:"memory",l:"flirty",he:"מה הבדיחה הפנימית שלכם שרק שניכם מבינים?",en:"What's your inside joke that only the two of you understand?"},
      {t:"couple_dare",l:"flirty",he:"חבקו אחד את השני למשך 60 שניות בשקט מלא — אל תפרדו",en:"Hug each other for 60 seconds in complete silence — don't let go"},
      {t:"couple_dare",l:"flirty",he:"האחד יסגור עיניים — השני ינחה אותם ב-3 נשיקות קלות לבחירתו",en:"One closes eyes — the other guides 3 light kisses of their choice"},
      {t:"couple_dare",l:"flirty",he:"כל אחד מחזיק את יד השני ומרגיש — ואומר מה הוא מרגיש שם",en:"Each holds the other's hand and feels — then says what they feel there"},
      {t:"couple_dare",l:"flirty",he:"שבו פנים אל פנים, עין לעין 30 שניות — ואז בחרו: מה אתם רוצים לומר?",en:"Sit face to face, eye contact for 30 seconds — then: what do you want to say?"},
      {t:"couple_dare",l:"flirty",he:"כל אחד כותב על נייר את הרגש שהוא מרגיש כרגע — מחליפים ורואים",en:"Each writes the emotion they feel right now on paper — swap and see"},
      {t:"couple_dare",l:"flirty",he:"שחקו מראה — האחד מוביל תנועות, השני מחקה בדיוק — 2 דקות",en:"Play mirror — one leads movements, the other copies exactly — 2 minutes"},
      {t:"couple_dare",l:"flirty",he:"ספרו ביחד ל-3 ואחרי כן כל אחד אומר משפט אחד לאחר בו-זמנית",en:"Count to 3 together then each says one sentence to the other simultaneously"},
      {t:"couple_dare",l:"flirty",he:"כתבו ביחד בעיניים עצומות ציור של הבית שתרצו לגור בו",en:"With eyes closed together draw the house you'd want to live in"},
      {t:"future",l:"deep",he:"מה אתם רוצים שיהיה שונה בחיים שלכם בעוד 5 שנים?",en:"What do you want to be different about your life in 5 years?"},
      {t:"future",l:"deep",he:"ספרו ביחד: מה המקום שאתם הכי רוצים לבקר ביחד?",en:"Tell together: what's the place you most want to visit together?"},
      {t:"future",l:"deep",he:"אם תוכלו לבנות את השגרה המושלמת שלכם — איך נראה היום המושלם?",en:"If you could build your perfect routine — what does the perfect day look like?"},
      {t:"future",l:"deep",he:"מה הפחד שלכם לגבי העתיד שביחד יכולתם להתגבר עליו?",en:"What's your fear about the future that together you could overcome?"},
      {t:"future",l:"deep",he:"כל אחד אומר: בעוד 10 שנים אני רואה אותנו... ומשלים",en:"Each says: In 10 years I see us... and completes the sentence"},
      {t:"future",l:"deep",he:"מה המנהג שתרצו להקים ביחד כדי לחזק את הקשר?",en:"What custom would you want to establish together to strengthen your bond?"},
      {t:"future",l:"deep",he:"ספרו ביחד חלום אחד משותף שעדיין לא דיברתם עליו בגלוי",en:"Tell together one shared dream you haven't spoken about openly yet"},
      {t:"future",l:"deep",he:"מה הדבר שהכי מפחיד אותך לבקש מבן/בת הזוג — ולמה?",en:"What's the thing you're most afraid to ask your partner for — and why?"},
    ]
  },
  // ── 3. חבר'ה ביחד ───────────────────────────────────────────────
  { name_he:"חבר'ה ביחד", name_en:"Friends Party Wheel",
    desc_he:"גלגל המסיבה לחברים — אמת מביכה, אתגרים מגוחכים, מי הכי, סיפורים ופעילויות משוגעות.",
    desc_en:"The party wheel for friends — embarrassing truth, silly dares, who's most likely, stories and crazy activities.",
    slug:"friends-party-spin", bg_value:"#1a1200",
    cats:[
      {key:"truth_fun",   label_he:"😂 אמת כיפית", label_en:"😂 Fun Truth",   color:"#F39C12"},
      {key:"dare_silly",  label_he:"🎭 העז מגוחך", label_en:"🎭 Silly Dare",  color:"#E67E22"},
      {key:"who_most",    label_he:"👑 מי הכי?",   label_en:"👑 Who's Most?", color:"#F1C40F"},
      {key:"story_share", label_he:"📖 ספר לנו",   label_en:"📖 Tell Us",     color:"#FF6B35"},
      {key:"activity_now",label_he:"🏃 עשה עכשיו", label_en:"🏃 Do It Now",   color:"#FFA726"},
    ],
    qs:[
      {t:"truth_fun",l:"light",he:"מה הכי מביך שאמרת כשהיית שיכור/ה?",en:"What's the most embarrassing thing you've said while drunk?"},
      {t:"truth_fun",l:"light",he:"מי בחבורה הכי פחות תואם/ת לאדם שהוא/היא מנסה להיות?",en:"Who in the group least matches the person they're trying to be?"},
      {t:"truth_fun",l:"light",he:"מה הדבר שאתה מתבייש להודות שאתה אוהב — סרט, אוכל, שיר?",en:"What are you embarrassed to admit you love — movie, food, song?"},
      {t:"truth_fun",l:"light",he:"ספר על פעם שניסית להיראות מגניב/ה ויצא בדיוק הפוך",en:"Tell about a time you tried to look cool and it backfired completely"},
      {t:"truth_fun",l:"light",he:"מה הדבר הכי מוזר שחשבת עליו בשבוע האחרון?",en:"What's the weirdest thing you thought about in the past week?"},
      {t:"truth_fun",l:"light",he:"אם מישהו בחדר היה צריך לספר סיפור מביך עליך — מי זה?",en:"If someone in the room had to tell an embarrassing story about you — who?"},
      {t:"truth_fun",l:"light",he:"מה הדבר האחרון שחיפשת באינטרנט שהיית מתבייש שיראו?",en:"What's the last thing you searched online you'd be embarrassed if seen?"},
      {t:"truth_fun",l:"light",he:"כמה זמן הלכת בלי מקלחת? תהיה כנה.",en:"How long have you gone without showering? Be honest."},
      {t:"truth_fun",l:"light",he:"מה הנאשמת/ת בו ביותר מצד חברים — ומאיפה זה בא?",en:"What are you most accused of by friends — and where does it come from?"},
      {t:"dare_silly",l:"light",he:"עשה ריקוד של 30 שניות לשיר שאחד הנוכחים בוחר",en:"Do a 30-second dance to a song one of those present chooses"},
      {t:"dare_silly",l:"light",he:"שיר בקול את הג'ינגל הראשון שעולה לך בראש",en:"Sing aloud the first jingle that comes to your mind"},
      {t:"dare_silly",l:"light",he:"חקה את האדם משמאלך כשהוא הולך — קום ועשה עכשיו",en:"Imitate the person to your left when they walk — get up and do it now"},
      {t:"dare_silly",l:"light",he:"כתוב הודעת וואטסאפ לאמא שלך ואמור לה אני כוכב לכת — הראה לנו",en:"Write a WhatsApp to your mom saying I am a planet — show us"},
      {t:"dare_silly",l:"light",he:"אכול כפית מהדבר הכי חריף שיש כרגע בסביבה",en:"Eat a teaspoon of the spiciest thing available right now"},
      {t:"dare_silly",l:"light",he:"ספר בדיחה כה גרועה שכולם יאנחו ולא יצחקו",en:"Tell a joke so bad everyone will groan and not laugh"},
      {t:"dare_silly",l:"light",he:"עשה סלפי עם הפנים הכי מגוחכות שאתה יכול ושתף בסטטוס",en:"Make a selfie with the funniest face you can and share it as a status"},
      {t:"dare_silly",l:"light",he:"בלי ידיים — שתה מכוס בדרך היצירתית ביותר שתמצא",en:"Without hands — drink from a cup in the most creative way you can find"},
      {t:"who_most",l:"light",he:"מי הכי סביר שייעלם לשנה לאי בגפו ויחזור שמח?",en:"Who's most likely to disappear to an island alone for a year and come back happy?"},
      {t:"who_most",l:"light",he:"מי הכי סביר שיהפוך לתוכן יוצר ויצבור מיליון עוקבים?",en:"Who's most likely to become a content creator and gain a million followers?"},
      {t:"who_most",l:"light",he:"מי הכי סביר שישכח את יום ההולדת של כולם — כולל שלו?",en:"Who's most likely to forget everyone's birthday — including their own?"},
      {t:"who_most",l:"light",he:"מי הכי סביר שיתווכח עם מלצר על חשבון של 3 שקלים?",en:"Who's most likely to argue with a waiter over 3 shekels on the bill?"},
      {t:"who_most",l:"light",he:"מי הכי סביר שיכתוב ספר שאחד יקרא?",en:"Who's most likely to write a book that one person will read?"},
      {t:"who_most",l:"light",he:"מי הכי סביר שיצלח ממשחק ריאליטי ויפסיד בגמר?",en:"Who's most likely to excel at a reality show and lose in the final?"},
      {t:"who_most",l:"light",he:"מי הכי סביר שיהיה ראש עיר קטנה ויקלקל הכול?",en:"Who's most likely to become mayor of a small town and mess everything up?"},
      {t:"who_most",l:"light",he:"מי הכי סביר שיהיה עוד 20 שנה בדיוק אותו אדם עם אותן הבעיות?",en:"Who's most likely to be the exact same person in 20 years with the same problems?"},
      {t:"story_share",l:"deep",he:"ספר על הפעם שצחקת הכי הרבה בחיים שלך — מה קרה?",en:"Tell about the time you laughed the hardest in your life — what happened?"},
      {t:"story_share",l:"deep",he:"ספר על פעם שהיית בטוח/ה שיש לך חבר/ה טוב/ה ויצא שלא",en:"Tell about a time you were sure you had a good friend and turned out you didn't"},
      {t:"story_share",l:"deep",he:"ספר על ההרפתקה הכי גדולה שעשית עם החברים האלה — או בכלל",en:"Tell about the biggest adventure you've had with these friends — or ever"},
      {t:"story_share",l:"deep",he:"ספר על פעם שניסית לעשות טוב ויצא בדיוק הפוך",en:"Tell about a time you tried to do good and it turned out the exact opposite"},
      {t:"story_share",l:"deep",he:"ספר על הנסיעה הכי בלתי נשכחת שלך — טובה או רעה",en:"Tell about your most memorable trip — good or bad"},
      {t:"story_share",l:"deep",he:"ספר על פעם שפחדת מאוד ולא הראית לאחרים",en:"Tell about a time you were very scared and didn't show it to others"},
      {t:"story_share",l:"deep",he:"ספר על רגע שהיית בור וניסית להסתיר את זה — ונחשפת",en:"Tell about a moment you were ignorant, tried to hide it — and got exposed"},
      {t:"activity_now",l:"light",he:"כולם קמים ועושים 15 קפיצות ביחד — בסנכרון מלא",en:"Everyone gets up and does 15 jumps together — in full sync"},
      {t:"activity_now",l:"light",he:"מי שפתח אחרון את הטלפון — מציג את הסלפי האחרון שלו לכולם",en:"Whoever last opened their phone — shows their last selfie to everyone"},
      {t:"activity_now",l:"light",he:"כולם עושים לאדם משמאלם מחמאה אמיתית — בתורות",en:"Everyone gives a genuine compliment to the person on their left — in turns"},
      {t:"activity_now",l:"light",he:"כולם שרים ביחד 10 שניות של השיר הכי שנון שאפשר לחשוב עליו",en:"Everyone sings together 10 seconds of the catchiest song right now"},
      {t:"activity_now",l:"light",he:"כל אחד שולף מהטלפון הצילום המביך ביותר שלו ומסביר",en:"Everyone pulls out their most embarrassing photo from their phone and explains"},
      {t:"activity_now",l:"light",he:"כולם מחקים את הבן-אדם שמולם בדיוק — 20 שניות",en:"Everyone imitates the person in front of them exactly — 20 seconds"},
      {t:"activity_now",l:"light",he:"כל אחד כותב שם חבר ומתאר אותו במילה אחד — ומקריא לכולם",en:"Each writes a friend's name and describes them in one word — reads aloud"},
      {t:"activity_now",l:"light",he:"כולם עושים את הצליל הכי מוזר שהם יכולים — ב-3,2,1 ביחד",en:"Everyone makes the weirdest sound they can — on 3,2,1 together"},
    ]
  },
  // ── 4. ניצוצות אינטימיים ─────────────────────────────────────────
  { name_he:"ניצוצות אינטימיים", name_en:"Intimate Sparks Wheel",
    desc_he:"לזוגות — נגיעות, לחישות, גילויים חושניים ומשימות אינטימיות שמחברות מחדש.",
    desc_en:"For couples — touches, whispers, sensual revelations and intimate missions that reconnect.",
    slug:"intimate-sparks-spin", bg_value:"#0d0006",
    cats:[
      {key:"touch_tender",label_he:"🤲 נגיעה",   label_en:"🤲 Touch",        color:"#8B0000"},
      {key:"whisper_say", label_he:"💋 לחש לי",  label_en:"💋 Whisper",      color:"#C41E3A"},
      {key:"reveal_heart",label_he:"🌹 גלה",      label_en:"🌹 Reveal",       color:"#B8860B"},
      {key:"together_now",label_he:"💑 ביחד",     label_en:"💑 Together",     color:"#A0522D"},
      {key:"feel_share",  label_he:"❤️ הרגש",    label_en:"❤️ Feel & Share", color:"#DC143C"},
    ],
    qs:[
      {t:"touch_tender",l:"flirty",he:"לאט מאוד — עבור בקצות אצבעותיך על הגב של הצד השני, מהכתף לכתף",en:"Slowly — trace your fingertips across the other's back, shoulder to shoulder"},
      {t:"touch_tender",l:"flirty",he:"קח/י את יד הצד השני ושחק/י בעדינות עם האצבעות — בלי מילים, דקה שלמה",en:"Take the other's hand and gently play with the fingers — no words, one full minute"},
      {t:"touch_tender",l:"flirty",he:"הצמד/י את המצח שלך אל המצח שלהם וסגור/י עיניים — 30 שניות",en:"Press your forehead to theirs and close your eyes — 30 seconds"},
      {t:"touch_tender",l:"flirty",he:"עסה/י בעדינות את הכתפיים של הצד השני — 2 דקות מלאות",en:"Gently massage the other's shoulders — 2 full minutes"},
      {t:"touch_tender",l:"flirty",he:"גע/י בלחי הצד השני בכף ידך ותן/י לה לנוח שם — ותסתכלו זה לזה",en:"Touch the other's cheek with your palm and let it rest there — look at each other"},
      {t:"touch_tender",l:"flirty",he:"קח/י את הראש של הצד השני בין ידיך בעדינות ותנשק/י את המצח",en:"Take the other's head gently between your hands and kiss their forehead"},
      {t:"touch_tender",l:"flirty",he:"שב/י מאחורי הצד השני ועבור/י לאט על שערם בעדינות — 2 דקות",en:"Sit behind the other and slowly run your fingers through their hair — 2 min"},
      {t:"touch_tender",l:"flirty",he:"אחז/י בשתי ידיים של הצד השני ומשוך/י אותם אליך לחיבוק איטי",en:"Hold both of the other's hands and pull them slowly into a hug"},
      {t:"touch_tender",l:"flirty",he:"עבור/י בעדינות על הזרוע של הצד השני — מהכתף למרפק — בשתיקה",en:"Gently trace the other's arm — from shoulder to elbow — in silence"},
      {t:"whisper_say",l:"flirty",he:"לחוש באוזן: הדבר שהכי מושך אותי בך הוא...",en:"Whisper in their ear: The thing that attracts me most about you is..."},
      {t:"whisper_say",l:"flirty",he:"לחוש: בפעם האחרונה שהסתכלתי עליך חשבתי...",en:"Whisper: The last time I looked at you I thought..."},
      {t:"whisper_say",l:"flirty",he:"לחוש משהו שרצית להגיד בשבוע האחרון ולא הגדת",en:"Whisper something you wanted to say in the past week and didn't"},
      {t:"whisper_say",l:"flirty",he:"לחוש: הרגע הכי חושני שהיה לנו היה... ותאר/י",en:"Whisper: The most sensual moment we had was... and describe it"},
      {t:"whisper_say",l:"flirty",he:"לחוש: כשאתה/ת עושה _____ זה גורם לי להרגיש _____",en:"Whisper: When you do _____ it makes me feel _____"},
      {t:"whisper_say",l:"flirty",he:"לחוש: המקום שאני הכי רוצה שתגע/י בו עכשיו הוא...",en:"Whisper: The place I most want you to touch right now is..."},
      {t:"whisper_say",l:"flirty",he:"לחוש: פנטזיה קטנה שיש לי עליך היא...",en:"Whisper: A small fantasy I have about you is..."},
      {t:"whisper_say",l:"flirty",he:"לחוש באוזן: שלוש מילים שמתארות איך אתה/ת גורם/ת לי להרגיש",en:"Whisper in their ear: Three words describing how you make me feel"},
      {t:"reveal_heart",l:"deep",he:"גלה מה המקום הגופני שהכי נעים לך שנוגעים בו — ופרט",en:"Reveal the physical place that feels most pleasant when touched — and detail"},
      {t:"reveal_heart",l:"deep",he:"ספר מה הכי מדליק/ה אותך רגשית אצל הצד השני",en:"Tell what emotionally arouses you most about the other person"},
      {t:"reveal_heart",l:"deep",he:"גלה פנטזיה רומנטית אחת שעדיין לא הגשמתם ביחד",en:"Reveal one romantic fantasy you haven't fulfilled together yet"},
      {t:"reveal_heart",l:"deep",he:"ספר מה הזמן שהרגשת הכי חושני/ת ורצית שהוא לא ייגמר",en:"Tell about the time you felt most sensual and wanted it not to end"},
      {t:"reveal_heart",l:"deep",he:"גלה מה הצליל, הריח, או המגע שהכי מרגיע אותך אצל הצד השני",en:"Reveal what sound, smell, or touch from the other person most calms you"},
      {t:"reveal_heart",l:"deep",he:"ספר מה הדבר שרצית לנסות ביחד ועוד לא העזתם",en:"Tell about something you've wanted to try together and haven't dared yet"},
      {t:"reveal_heart",l:"deep",he:"גלה מה גורם לך להרגיש הכי נראה/ת ואהוב/ה על ידי הצד השני",en:"Reveal what makes you feel most seen and loved by the other person"},
      {t:"reveal_heart",l:"deep",he:"ספר מה הציפייה שלך מהצד השני שלא בא לידי ביטוי מספיק",en:"Tell about one expectation from your partner that isn't expressed enough"},
      {t:"together_now",l:"flirty",he:"כבו אורות, הדליקו נר אחד ושבו בשתיקה בנוכחות זה של זה — 3 דקות",en:"Turn off lights, light one candle and sit in silence in each other's presence — 3 min"},
      {t:"together_now",l:"flirty",he:"כל אחד בוחר שיר שמייצג אותו — ושומעים ביחד בשתיקה",en:"Each picks a song that represents them — and you listen together in silence"},
      {t:"together_now",l:"flirty",he:"הכינו ביחד כוס משקה חם — האחד מכין, השני בוחר — ושתו ביחד",en:"Prepare a hot drink together — one makes it, the other chooses — drink together"},
      {t:"together_now",l:"flirty",he:"עשו עיסוי ידיים הדדי — 2 דקות כל אחד, אחרי כן מחליפים",en:"Give each other hand massages — 2 minutes each, then switch"},
      {t:"together_now",l:"flirty",he:"כתבו ביחד רשימה של 10 דברים שאתם אוהבים לעשות ביחד",en:"Write together a list of 10 things you love doing together"},
      {t:"together_now",l:"flirty",he:"שבו גב אל גב, עצמו עיניים, ונשמו ביחד 10 נשימות עמוקות",en:"Sit back to back, close eyes, and breathe together 10 deep breaths"},
      {t:"together_now",l:"flirty",he:"כל אחד מצייר את הפנים של השני מבלי להסתכל על הנייר — ומראה",en:"Each draws the other's face without looking at the paper — then shows"},
      {t:"feel_share",l:"deep",he:"ספר ברגע זה: כשאני איתך אני מרגיש/ה... — השלם עם 3 רגשות",en:"Say right now: When I'm with you I feel... — complete with 3 emotions"},
      {t:"feel_share",l:"deep",he:"מה הרגשת עם הלב שלך כשהצד השני נכנס לחדר היום?",en:"What did you feel in your heart when the other person entered the room today?"},
      {t:"feel_share",l:"deep",he:"מה הדבר שהכי מרגש אותך אצל הצד השני — בשגרה היומיומית?",en:"What moves you most about the other person — in everyday routine?"},
      {t:"feel_share",l:"deep",he:"ספר על רגע שהרגשת שאתם שניים הכי בטוחים בעולם",en:"Tell about a moment you both felt safest in the world"},
      {t:"feel_share",l:"deep",he:"מה הרגש שאתה/ת מתקשה/ת לבטא ורוצה/ת שהצד השני ידע?",en:"What emotion do you find hard to express and want the other person to know?"},
      {t:"feel_share",l:"deep",he:"ספר מה מרגיש לך הבית בקשר הזה — מה זה נראה?",en:"Tell what home feels like in this relationship — what does it look like?"},
      {t:"feel_share",l:"deep",he:"מה הדבר שגורם לך להרגיש הכי אהוב/ה על ידי הצד השני?",en:"What makes you feel most loved by the other person?"},
      {t:"feel_share",l:"deep",he:"אם הקשר שלכם היה ריח — איזה ריח הוא היה ולמה?",en:"If your relationship had a scent — what scent would it be and why?"},
    ]
  },
  // ── 5. התחדשות הזוג ──────────────────────────────────────────────
  { name_he:"התחדשות הזוג", name_en:"Couple Renewal Wheel",
    desc_he:"לזוגות ותיקים — להחזיר ניצוצות, לומר מה שלא נאמר, לגלות מחדש ולחלום ביחד.",
    desc_en:"For established couples — reignite sparks, say what's unsaid, rediscover each other and dream together.",
    slug:"couple-renewal-spin", bg_value:"#001020",
    cats:[
      {key:"unsaid_words",  label_he:"💬 לא נאמר",     label_en:"💬 Unsaid",         color:"#1565C0"},
      {key:"gratitude_real",label_he:"🙏 תודה אמיתית", label_en:"🙏 Real Gratitude",  color:"#283593"},
      {key:"rediscover",    label_he:"🔍 גלה מחדש",    label_en:"🔍 Rediscover",      color:"#0277BD"},
      {key:"dare_reconnect",label_he:"✅ אתגר חיבור",  label_en:"✅ Reconnect Dare",  color:"#006064"},
      {key:"vision_share",  label_he:"🌙 חזון משותף",  label_en:"🌙 Shared Vision",   color:"#37474F"},
    ],
    qs:[
      {t:"unsaid_words",l:"deep",he:"אמור משהו שרצית להגיד השבוע לבן/בת הזוג ולא הגדת",en:"Say something you wanted to tell your partner this week and didn't"},
      {t:"unsaid_words",l:"deep",he:"מה הדבר שאתה/ת מרגיש/ה שלא מקבל/ת בקשר — ועוד לא אמרת?",en:"What do you feel you're not getting in the relationship — and haven't said yet?"},
      {t:"unsaid_words",l:"deep",he:"מה הייתת רוצה לשמוע מהצד השני יותר — בתדירות, בעומק?",en:"What would you like to hear from the other person more — more often, more deeply?"},
      {t:"unsaid_words",l:"deep",he:"ספר על פעם שנפגעת ולא אמרת — ועדיין זה נשאר בלב",en:"Tell about a time you were hurt and didn't say so — and it still stays with you"},
      {t:"unsaid_words",l:"deep",he:"מה ציפייה אחת שיש לך מהצד השני שמעולם לא ביטאת בבירור?",en:"What's one expectation from your partner you've never clearly expressed?"},
      {t:"unsaid_words",l:"deep",he:"מה הרגע שרצית חיבוק ולא ביקשת?",en:"What's the moment you wanted a hug and didn't ask?"},
      {t:"unsaid_words",l:"deep",he:"מה הגבול שחשוב לך שהצד השני יכבד — ועוד לא הצבת?",en:"What's a boundary important to you that your partner should respect — and you haven't set?"},
      {t:"unsaid_words",l:"deep",he:"אמור: הדבר שהכי קשה לי לבקש ממך הוא... וסיים את המשפט",en:"Say: The hardest thing for me to ask of you is... and complete the sentence"},
      {t:"unsaid_words",l:"deep",he:"מה הנושא שאתם נמנעים ממנו — ואיך נוכל לפתוח אותו?",en:"What topic have you been avoiding — and how could you open it?"},
      {t:"gratitude_real",l:"light",he:"ספר על רגע אחד מהחיים שלכם שאתה/ת אסיר/ת תודה עליו",en:"Tell about one moment in your life together you are grateful for"},
      {t:"gratitude_real",l:"light",he:"מה הדבר שהצד השני עשה בשנה האחרונה שהכי נגע ללבך?",en:"What did your partner do in the past year that touched your heart most?"},
      {t:"gratitude_real",l:"light",he:"תודה על דבר שהצד השני עושה בשגרה שנראה קטן אבל משמעותי",en:"Thank your partner for something routine they do that seems small but is meaningful"},
      {t:"gratitude_real",l:"light",he:"מה היית גרוע/ה בו בלי הצד השני?",en:"What would you be worse at without your partner?"},
      {t:"gratitude_real",l:"light",he:"אמור בקול: אני שמח/ה שאתה/ת בחיים שלי כי... — 3 סיבות",en:"Say aloud: I'm glad you're in my life because... — 3 reasons"},
      {t:"gratitude_real",l:"light",he:"מה הצד השני לימד אותך שלא ידעת קודם?",en:"What did your partner teach you that you didn't know before?"},
      {t:"gratitude_real",l:"light",he:"אחז/י בידי הצד השני ואמור/י תודה על הזמן שלכם ביחד",en:"Hold your partner's hands and say thank you for the time you have together"},
      {t:"gratitude_real",l:"light",he:"מה הזכרון אחד מהקשר שאתה/ת בטוח/ה לא תשכח לעולם?",en:"What's one memory from the relationship you're sure you'll never forget?"},
      {t:"rediscover",l:"flirty",he:"שאל/י שאלה שמעולם לא שאלת את בן/בת הזוג — על ילדות, חלום, פחד",en:"Ask a question you've never asked your partner — about childhood, dream, fear"},
      {t:"rediscover",l:"flirty",he:"מה עניין חדש שהצד השני פיתח ואתה/ת עדיין לא ממש מכיר/ה?",en:"What new interest has your partner developed that you don't really know yet?"},
      {t:"rediscover",l:"flirty",he:"מה גילית על הצד השני בחצי השנה האחרונה שהפתיע אותך?",en:"What did you discover about your partner in the last six months that surprised you?"},
      {t:"rediscover",l:"flirty",he:"תאר/י מה לדעתך הצד השני הכי שמח בו בחיים כרגע",en:"Describe what you think your partner is happiest about in life right now"},
      {t:"rediscover",l:"flirty",he:"מה שינוי חיובי אחד שאתה/ת מבחין/ה בבן/בת הזוג מאז שהכרתם?",en:"What's one positive change you notice in your partner since you met?"},
      {t:"rediscover",l:"flirty",he:"ספר מה אתה/ת חושב/ת שהצד השני הכי גאה בו — ומדוע?",en:"Tell what you think your partner is most proud of — and why?"},
      {t:"rediscover",l:"flirty",he:"מה תשאל/י את הצד השני אם ידעת שהוא/היא ייענה בכנות מלאה?",en:"What would you ask your partner if you knew they'd answer with complete honesty?"},
      {t:"rediscover",l:"flirty",he:"מה משהו שאתה/ת עדיין מגלה על עצמך — ורוצה/ת לשתף?",en:"What's something you're still discovering about yourself — and want to share?"},
      {t:"dare_reconnect",l:"flirty",he:"כבו את הטלפונים, שבו פנים אל פנים — שיחה של 15 דקות רק על אתם",en:"Turn off phones, sit face to face — 15-minute conversation only about you two"},
      {t:"dare_reconnect",l:"flirty",he:"צאו לטיול של 10 דקות ביחד עכשיו — בלי יעד, רק ביחד",en:"Go for a 10-minute walk together right now — no destination, just together"},
      {t:"dare_reconnect",l:"flirty",he:"שחקו 20 שניות של אל תצחק — מי שמצחיק ראשון מפסיד",en:"Play 20 seconds of Don't laugh — whoever laughs first loses"},
      {t:"dare_reconnect",l:"flirty",he:"כל אחד כותב 3 הבטחות קטנות לשבוע הקרוב לצד השני — ומקריא",en:"Each writes 3 small promises for the next week to the other — and reads aloud"},
      {t:"dare_reconnect",l:"flirty",he:"חבקו אחד את השני 90 שניות — כי אוקסיטוצין מתחיל שם",en:"Hug each other for 90 seconds — because oxytocin starts there"},
      {t:"dare_reconnect",l:"flirty",he:"ספרו ביחד 3 דברים שאתם מסכימים עליהם — ו-1 שאתם לא",en:"Tell together 3 things you agree on — and 1 you don't"},
      {t:"dare_reconnect",l:"flirty",he:"תכננו תאריך לשעה קרובה שלא קשורה לשגרה — ותאמרו מה הוא",en:"Plan a date for the near future unrelated to routine — and say what it is"},
      {t:"vision_share",l:"deep",he:"ספרו ביחד: איך נראה הבית שאתם רוצים בעוד 5 שנים — פרטים",en:"Tell together: what does the home you want in 5 years look like — details"},
      {t:"vision_share",l:"deep",he:"מה הדבר שאתם רוצים לשנות בחיים שלכם יחד ב-12 חודשים הקרובים?",en:"What do you want to change together in your life in the next 12 months?"},
      {t:"vision_share",l:"deep",he:"אם תוכלו לקחת חופשה בלי הגבלות — לאן תלכו ומה תעשו?",en:"If you could take a vacation without restrictions — where and what would you do?"},
      {t:"vision_share",l:"deep",he:"כל אחד אומר: בעוד 10 שנים אני רואה אותנו... ומשלים",en:"Each says: In 10 years I see us... and completes the sentence"},
      {t:"vision_share",l:"deep",he:"מה המנהג שתרצו לאמץ כזוג שיחזק אתכם?",en:"What's one custom you'd like to adopt as a couple that will strengthen you?"},
      {t:"vision_share",l:"deep",he:"מה הדבר שהכי מפחיד אותך בעתיד המשותף שלכם — ומה שנותן לך שלווה?",en:"What scares you most about your shared future — and what gives you peace?"},
      {t:"vision_share",l:"deep",he:"מה מטרה זוגית אחת שתרצו להשיג ב-6 חודשים הקרובים?",en:"What's one couple goal you want to achieve in the next 6 months?"},
    ]
  },
  // ── 6. טוב ממסעדה וסרט ──────────────────────────────────────────
  { name_he:"טוב ממסעדה וסרט", name_en:"Better Than Movie & Restaurant",
    desc_he:"ערב שונה, חוויתי ומרגש — יוצרים, חולמים, מתכננים ומחייכים ביחד יותר מכל סרט.",
    desc_en:"A different, experiential evening — creating, dreaming, planning and smiling together more than any movie.",
    slug:"better-date-spin", bg_value:"#001a0d",
    cats:[
      {key:"create_together",label_he:"🎨 יצירה",      label_en:"🎨 Create",          color:"#00897B"},
      {key:"mini_adventure", label_he:"🗺️ הרפתקה",     label_en:"🗺️ Adventure",       color:"#2E7D32"},
      {key:"bucket_item",    label_he:"📋 חלום לממש",  label_en:"📋 Bucket Dream",    color:"#0097A7"},
      {key:"fun_challenge",  label_he:"🎮 אתגר כיף",   label_en:"🎮 Fun Challenge",   color:"#388E3C"},
      {key:"plan_dream",     label_he:"📅 תכנון עתיד", label_en:"📅 Plan the Future", color:"#00695C"},
    ],
    qs:[
      {t:"create_together",l:"light",he:"כתבו ביחד שיר של 4 שורות על הערב שלכם — כל אחד כותב שורה לסירוגין",en:"Write together a 4-line poem about your evening — each writes one line alternately"},
      {t:"create_together",l:"light",he:"צייר/י ביחד ציור של הבית שלנו — כל אחד מוסיף פרט בתורו",en:"Draw together our home — each adds one detail in turn"},
      {t:"create_together",l:"light",he:"המציאו ביחד קוקטייל/שייק חדש מהמרכיבים שיש עכשיו — ושמו",en:"Invent a new cocktail/shake together from available ingredients — and name it"},
      {t:"create_together",l:"light",he:"ספרו ביחד סיפור קצר על שניכם — כל אחד מוסיף משפט אחד",en:"Tell a short story together about the two of you — each adds one sentence"},
      {t:"create_together",l:"light",he:"צרו ביחד הפלייליסט שלנו של 10 שירים — כל אחד מוסיף 5",en:"Create together our playlist of 10 songs — each adds 5"},
      {t:"create_together",l:"light",he:"עצבו ביחד ארוחת בוקר מושלמת — מה יש עליה? ציירו אותה",en:"Design together the perfect breakfast — what is on it? Draw it"},
      {t:"create_together",l:"light",he:"המציאו שם לזוג שלכם — ועצבו לוגו על נייר",en:"Invent a couple name — and design a logo on paper"},
      {t:"create_together",l:"light",he:"כתבו ביחד מניפסט הזוג — 5 ערכים שהכי חשובים לכם",en:"Write together a couple manifesto — 5 values most important to you"},
      {t:"mini_adventure",l:"flirty",he:"יצאו עכשיו לחוץ למשך 10 דקות — מצאו משהו יפה ושתפו",en:"Go outside right now for 10 minutes — find something beautiful and share it"},
      {t:"mini_adventure",l:"flirty",he:"בחרו אקראית עיר/מקום במפה — תכננו חופשה דמיונית שם",en:"Randomly choose a city on a map — plan an imaginary vacation there"},
      {t:"mini_adventure",l:"flirty",he:"עשו דבר אחד שלא עשיתם ביחד מעולם — בתוך הבית",en:"Do one thing together you've never done before — inside the house"},
      {t:"mini_adventure",l:"flirty",he:"ספרו ביחד את 5 ההרפתקאות הכי גדולות שחלמתם לעשות",en:"List together the 5 biggest adventures you have dreamed of doing"},
      {t:"mini_adventure",l:"flirty",he:"קבעו יציאה ספונטנית לשבוע הבא — לאן שהאצבע תצביע במפה",en:"Set a spontaneous outing for next week — wherever your finger points on the map"},
      {t:"mini_adventure",l:"flirty",he:"ספרו על ההרפתקה הכי טובה שהיתה לכם ביחד — עם פרטים",en:"Tell about the best adventure you've had together — with details"},
      {t:"mini_adventure",l:"flirty",he:"תכנן/י הפתעה קטנה לצד השני לשבוע הבא — ותרמוז על מה זה",en:"Plan a small surprise for your partner for next week — and hint what it is"},
      {t:"mini_adventure",l:"flirty",he:"המציאו חוקי ערב המשחק שלנו — 3 חוקים מגוחכים שיחייבו אתכם",en:"Invent our game night rules — 3 silly rules that will bind you"},
      {t:"bucket_item",l:"deep",he:"כל אחד אומר דבר אחד מרשימת החלומות שלו שרוצה לממש ב-5 שנים",en:"Each says one thing from their bucket list to fulfill in 5 years"},
      {t:"bucket_item",l:"deep",he:"מה חוויה אחת שאתם רוצים לחיות ביחד לפחות פעם אחת?",en:"What's one experience you want to live together at least once?"},
      {t:"bucket_item",l:"deep",he:"ספרו ביחד 3 מקומות שאתם רוצים לראות לפני שתמותו",en:"List together 3 places you want to see before you die"},
      {t:"bucket_item",l:"deep",he:"תכננו ביחד שנת חלום — איך היא נראית?",en:"Plan together a dream year — what does it look like?"},
      {t:"bucket_item",l:"deep",he:"כל אחד כותב 3 חלומות על נייר — מחליפים ומגיבים",en:"Each writes 3 dreams on paper — swap and respond"},
      {t:"bucket_item",l:"deep",he:"מה הדבר שאתם רוצים לעשות ביחד ועדיין לא מצאתם זמן?",en:"What's something you want to do together and still haven't found time for?"},
      {t:"bucket_item",l:"deep",he:"בחרו יחד פרויקט ביחד שתתחילו בחודש הקרוב — ומה זה?",en:"Choose together a together project to start next month — and what is it?"},
      {t:"bucket_item",l:"deep",he:"מה הדבר שאם הייתם עושים יותר — הקשר שלכם היה מרגיש טוב יותר?",en:"What's something that if you did more — your relationship would feel better?"},
      {t:"fun_challenge",l:"light",he:"מי יצליח לאזן עיפרון על האף זמן רב יותר? 3 ניסיונות",en:"Who can balance a pencil on their nose longer? 3 attempts each"},
      {t:"fun_challenge",l:"light",he:"מי יצליח לחקות את הצד השני בשיר — בלי להגיד מה השיר?",en:"Who can imitate the other humming a song — without saying what it is?"},
      {t:"fun_challenge",l:"light",he:"מי יצליח להגיד את האלפבית בעברית הכי מהר? מתחרים",en:"Who can say the Hebrew alphabet fastest? Compete"},
      {t:"fun_challenge",l:"light",he:"כתבו 60 שניות כמה שיותר תכונות טובות זה על זה — ואחר כך מחליפים",en:"Write for 60 seconds as many good qualities about each other as possible — swap"},
      {t:"fun_challenge",l:"light",he:"שחקו מה יש בתיק — כל אחד מוציא פריט ומספר מדוע הוא שם",en:"Play what's in the bag — each takes out one item and explains why it's there"},
      {t:"fun_challenge",l:"light",he:"מי יכול לזכור יותר פרטים מהפגישה הראשונה שלכם? בדקו",en:"Who can remember more details from your first meeting? Test each other"},
      {t:"fun_challenge",l:"light",he:"כל אחד מתחיל משפט באנחנו תמיד... — והשני מסיים אחרת",en:"Each starts a sentence with We always... — and the other finishes it differently"},
      {t:"fun_challenge",l:"light",he:"שחקו מחוות — ניחושי סרטים, שירים, ספרים — כל אחד בתורו",en:"Play charades — movies, songs, books — each takes a turn"},
      {t:"plan_dream",l:"deep",he:"תכנן/י ביחד חופשה חלומית ב-10 דקות — יעד, לינה, פעילות אחת",en:"Plan together a dream vacation in 10 minutes — destination, accommodation, one activity"},
      {t:"plan_dream",l:"deep",he:"ספרו מה הערב המושלם ביחד נראה עבורכם — פרטים קטנים",en:"Tell what the perfect evening together looks like — small details"},
      {t:"plan_dream",l:"deep",he:"מה מנהג חדש אחד שתרצו להוסיף לחיים שלכם ביחד?",en:"What new routine would you want to add to your life together?"},
      {t:"plan_dream",l:"deep",he:"תכננו יום ספונטני שיקרה בחודש הקרוב — בלי מבנה מראש",en:"Plan a spontaneous day to happen next month — with no pre-set structure"},
      {t:"plan_dream",l:"deep",he:"בנו יחד לוח זמנים חלומי לשבת הקרובה — גם אם לא ריאלי",en:"Build together a dream schedule for next Saturday — even if unrealistic"},
      {t:"plan_dream",l:"deep",he:"מה מטרה זוגית אחת שתרצו להשיג ב-6 חודשים הקרובים?",en:"What's one couple goal you want to achieve in the next 6 months?"},
      {t:"plan_dream",l:"deep",he:"מה הפרויקט האישי שכל אחד מכם רוצה לממש השנה — ואיך תתמכו?",en:"What's the personal project each wants to fulfill this year — and how will you support each other?"},
      {t:"plan_dream",l:"deep",he:"ספרו מה הדבר שאתם הכי מצפים לו ביחד בשנה הקרובה",en:"Tell what you're most looking forward to together in the coming year"},
    ]
  },
  // ── 7. שיא המיניות ───────────────────────────────────────────────
  { name_he:"שיא המיניות 🔥", name_en:"Peak Desire 🔥",
    desc_he:"פנטזיות נועזות, גוף, תפקידים, תשוקה ואתגרים לוהטים שמרימים את הטמפרטורה.",
    desc_en:"Bold fantasies, body, roleplay, desire and hot challenges that raise the temperature.",
    slug:"peak-desire-spin", bg_value:"#0a0000",
    cats:[
      {key:"fantasy_bold", label_he:"🔥 פנטזיה",    label_en:"🔥 Fantasy",   color:"#B71C1C"},
      {key:"body_game",    label_he:"💫 גוף",        label_en:"💫 Body",      color:"#880E4F"},
      {key:"roleplay_now", label_he:"🎭 תפקידים",    label_en:"🎭 Roleplay",  color:"#4A148C"},
      {key:"desire_reveal",label_he:"🌹 תשוקה",      label_en:"🌹 Desire",    color:"#BF360C"},
      {key:"hot_dare",     label_he:"⚡ אתגר לוהט", label_en:"⚡ Hot Dare",  color:"#827717"},
    ],
    qs:[
      {t:"fantasy_bold",l:"deep",he:"ספר/י פנטזיה אחת שעדיין לא סיפרת לאף אחד — ושתף/י את הצד השני",en:"Tell a fantasy you've never told anyone — and share it with your partner"},
      {t:"fantasy_bold",l:"deep",he:"מה התרחיש שאם הצד השני היה מציע — לא היית אומר/ת לא?",en:"What scenario, if your partner proposed, you wouldn't say no to?"},
      {t:"fantasy_bold",l:"deep",he:"תאר/י את הבוקר המושלם שאחרי הלילה המושלם — פרטים חושניים",en:"Describe the perfect morning after the perfect night — sensual details"},
      {t:"fantasy_bold",l:"deep",he:"מה הפנטזיה שהכי מביכה אותך לספר — ועדיין תספר/י?",en:"What's the fantasy most embarrassing to tell — and you'll tell it anyway?"},
      {t:"fantasy_bold",l:"deep",he:"מה הסצנה מסרט/ספר שמצאת הכי מגרה/ת — ולמה?",en:"What scene from a movie or book did you find most arousing — and why?"},
      {t:"fantasy_bold",l:"deep",he:"ספר/י על פנטזיית מיקום — איפה הכי תרצה/י שזה יקרה?",en:"Tell about a location fantasy — where would you most want it to happen?"},
      {t:"fantasy_bold",l:"deep",he:"מה הפנטזיית לבוש שלך — מה הצד השני לובש/ת שמשגע/ת אותך?",en:"What's your outfit fantasy — what does your partner wear that drives you crazy?"},
      {t:"fantasy_bold",l:"deep",he:"ספר/י על פנטזיית כוח — מי מוביל, מי נוהל — ואיך זה נראה?",en:"Tell about a power fantasy — who leads, who follows — and what does it look like?"},
      {t:"fantasy_bold",l:"deep",he:"מה הזמן ביום שהכי מתאים לאינטימיות — ולמה?",en:"What time of day is best for intimacy — and why?"},
      {t:"fantasy_bold",l:"deep",he:"תאר/י את הנשיקה המושלמת מנקודת מבטך — כל פרט",en:"Describe the perfect kiss from your perspective — every detail"},
      {t:"body_game",l:"flirty",he:"כסה/י עיניים של הצד השני ועבור/י בעדינות על הפנים שלהם בקצות אצבעותיך",en:"Cover the other's eyes and gently trace their face with your fingertips"},
      {t:"body_game",l:"flirty",he:"ספר/י לצד השני בפרטים: מה הנקודות שהכי נהנים שנוגעים בהן?",en:"Tell your partner in detail: what spots do you most enjoy being touched?"},
      {t:"body_game",l:"flirty",he:"עסה/י ביד אחת את צוואר הצד השני בעדינות — 3 דקות, בשתיקה",en:"Massage the other's neck with one hand gently — 3 minutes, in silence"},
      {t:"body_game",l:"flirty",he:"כסה/י עיניים ותן/י לצד השני לנחש מה אתה/ת עושה/ת — בנגיעות בלבד",en:"Cover eyes and let your partner guess what you're doing — only through touch"},
      {t:"body_game",l:"flirty",he:"עבור/י בשפתיים בעדינות על הכתף של הצד השני — ותאר/י את ההרגשה",en:"Move your lips gently along the other's shoulder — and describe the feeling"},
      {t:"body_game",l:"flirty",he:"שכבו זה על גבי זה — 2 דקות בשתיקה מלאה — ופשוט הרגישו",en:"Lie one on top of the other — 2 minutes in complete silence — and just feel"},
      {t:"body_game",l:"flirty",he:"מה המגע שהכי מדליק אותך? הראה/י לצד השני איפה ואיך בדיוק",en:"What touch most arouses you? Show your partner where and how exactly"},
      {t:"body_game",l:"flirty",he:"כסה/י עיניים — הצד השני נוגע בנקודה אחת בגוף — נחש/י איפה",en:"Cover eyes — partner touches one point on your body — guess where"},
      {t:"body_game",l:"flirty",he:"ספר/י לצד השני מה הם עושים בזמן נגיעה שמרגיש לך הכי טוב",en:"Tell your partner what they do during touch that feels best to you"},
      {t:"body_game",l:"flirty",he:"תאר/י את התחושה הגופנית שאתה/ת אוהב/ת בזמן קרבה — במילים",en:"Describe the physical sensation you love during closeness — in words"},
      {t:"roleplay_now",l:"flirty",he:"בחרו תרחיש: פגישה ראשונה במסעדה יוקרתית — ושחקו 5 דקות",en:"Choose the scenario: First meeting at a luxury restaurant — and play for 5 min"},
      {t:"roleplay_now",l:"flirty",he:"כל אחד לובש דמות שונה מעצמו — ומנהלים שיחה שלא תוכלו לנהל בדרך כלל",en:"Each takes on a character different from themselves — have a conversation you usually can't"},
      {t:"roleplay_now",l:"flirty",he:"תרחיש: זרים ברכבת לילה — מי מתחיל? 5 דקות",en:"Scenario: Strangers on a night train — who starts? 5 minutes"},
      {t:"roleplay_now",l:"flirty",he:"כל אחד כותב תפקיד שהוא/היא רוצה שהצד השני ישחק — ומחליפים",en:"Each writes a role they want their partner to play — then swap"},
      {t:"roleplay_now",l:"flirty",he:"שחקו ראיון עבודה — אחד מראיין, אחד מועמד — לתפקיד מגרה",en:"Play job interview — one interviews, one is candidate — for an arousing role"},
      {t:"roleplay_now",l:"flirty",he:"תרחיש: חדר מלון בעיר זרה — שניכם נפגשים שם לראשונה — ושחקו",en:"Scenario: Hotel room in a foreign city — you meet there for the first time — play"},
      {t:"roleplay_now",l:"flirty",he:"כל אחד בוחר שם בדוי לעצמו לרבע שעה — ומדברים כמו הדמויות האלה",en:"Each chooses a fake name for 15 minutes — and speaks as those characters"},
      {t:"roleplay_now",l:"flirty",he:"שחקו מי מנהיג — ל-10 דקות כל אחד מוביל — מחליפים",en:"Play who leads — for 10 minutes each leads — then switch"},
      {t:"desire_reveal",l:"deep",he:"מה הדבר שהצד השני עושה שמדליק אותך יותר מכל דבר אחר?",en:"What does your partner do that arouses you more than anything else?"},
      {t:"desire_reveal",l:"deep",he:"ספר/י מה הזמן שהרגשת הכי תשוקה — ומה גרם לזה?",en:"Tell about the time you felt the most desire — and what caused it?"},
      {t:"desire_reveal",l:"deep",he:"מה הקוד הסודי שרק הצד השני יודע — דבר שמוביל אותך לרצות?",en:"What's the secret code only your partner knows — something that leads you to desire?"},
      {t:"desire_reveal",l:"deep",he:"מה הדבר שאתה/ת רוצה שהצד השני יעשה יותר?",en:"What do you want your partner to do more of?"},
      {t:"desire_reveal",l:"deep",he:"ספר/י על הרגע שהכי הרגשתם תשוקה אחד לשני — מה קדם לו?",en:"Tell about the moment you felt the most desire for each other — what preceded it?"},
      {t:"desire_reveal",l:"deep",he:"מה הדבר שאתה/ת ביישן/ת לבקש ואתה/ת רוצה/ת?",en:"What's something you're shy to ask for and you want?"},
      {t:"desire_reveal",l:"deep",he:"ספר/י: מה גורם לי להרגיש הכי נחשק/ת ואהוב/ה הוא...",en:"Tell: What makes me feel most desired and loved is..."},
      {t:"desire_reveal",l:"deep",he:"מה הדבר שאתה/ת רוצה לנסות בפעם הבאה שלא ניסיתם?",en:"What's something you want to try next time that you haven't tried?"},
      {t:"desire_reveal",l:"deep",he:"מה הרגע האינטימי שאם היה קורה עוד היום — לא היית מתנגד/ת?",en:"What intimate moment if it happened today — you wouldn't resist?"},
      {t:"hot_dare",l:"flirty",he:"לאט ובעיניים עצומות — נשקו 60 שניות מלאות — בלי לפסוק",en:"Slowly with closed eyes — kiss for 60 full seconds — without stopping"},
      {t:"hot_dare",l:"flirty",he:"ספר/י לצד השני 3 דברים שאתה/ת עושה להם שהם אוהבים — ושאל/י: נכון?",en:"Tell your partner 3 things you do to them that they love — and ask: right?"},
      {t:"hot_dare",l:"flirty",he:"כסה/י עיניים — הצד השני מביא 2 עצמים — נחש/י מה הם ועל מה מרמזים",en:"Cover eyes — partner brings 2 objects — guess what they are and what they hint at"},
      {t:"hot_dare",l:"flirty",he:"כתבו ביחד: הלילה הכי טוב שנהיה לנו יהיה כשנ... — ומשלימים",en:"Write together: Our best night will be when we... — and complete it"},
      {t:"hot_dare",l:"flirty",he:"האחד יוביל ריקוד איטי של 3 דקות — בלי מוזיקה — רק גוף ותנועה",en:"One leads a slow dance for 3 minutes — without music — only body and movement"},
      {t:"hot_dare",l:"flirty",he:"כל אחד מקריב גזר דין לוהט — מה הצד השני צריך לעשות עכשיו?",en:"Each delivers a hot verdict — what does the other person have to do right now?"},
      {t:"hot_dare",l:"flirty",he:"שחקו מה אני מרגיש — נגיעה אחת, עיניים עצומות, ניחוש",en:"Play what do I feel — one touch, eyes closed, guess"},
      {t:"hot_dare",l:"flirty",he:"ספרו ביחד בתורות — אחד הדברים שהכי מושכים אותי בך הוא... — ל-5 סיבובים",en:"Take turns saying — One thing most attractive about you is... — for 5 rounds"},
    ]
  },
] as const;

export async function GET() {
  if (!SERVICE_KEY) {
    return NextResponse.json({ error: "SUPABASE_SERVICE_ROLE_KEY not set" }, { status: 500 });
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: { persistSession: false }
  });

  const results: Array<{slug: string; questions: number; error?: string}> = [];

  for (const game of GAMES) {
    // 1. Upsert game
    const { data: gameRow, error: gErr } = await supabase
      .from("games")
      .upsert({
        name_he: game.name_he, name_en: game.name_en,
        description_he: game.desc_he, description_en: game.desc_en,
        slug: game.slug, is_active: true,
        bg_type: "color", bg_value: game.bg_value,
        player_mode: false,
      }, { onConflict: "slug" })
      .select("id")
      .single();

    if (gErr || !gameRow) {
      results.push({ slug: game.slug, questions: 0, error: gErr?.message });
      continue;
    }
    const gameId = gameRow.id;

    // 2. Upsert wheel config
    const cats = [...game.cats];
    const slices       = makeSlices(cats);
    const playerConfig = makePlayerConfig(cats);
    const catColors    = makeCategoryColors(cats);

    await supabase.from("wheel_configs").upsert({
      game_id: gameId,
      slices, player_config: playerConfig, category_colors: catColors,
      pointer_color: "#ffffff", inner_circle: true,
      inner_circle_color: "#1a1a2e", inner_circle_border_color: "#ffffff",
      border_color: "#ffffff", divider_color: "#ffffff",
      divider_enabled: true, divider_width: 2,
      marker_config: MARKER_CONFIG,
    }, { onConflict: "game_id" });

    // 3. Re-seed questions
    await supabase.from("questions").delete().eq("game_id", gameId);

    const rows = game.qs.map(q => ({
      game_id: gameId, type: q.t, level: q.l,
      text_he: q.he, text_en: q.en, is_active: true,
    }));

    const { error: qErr } = await supabase.from("questions").insert(rows);
    results.push({ slug: game.slug, questions: qErr ? 0 : rows.length, error: qErr?.message });
  }

  const totalQ = results.reduce((s, r) => s + r.questions, 0);
  return NextResponse.json({ ok: true, totalGames: GAMES.length, totalQuestions: totalQ, results });
}
