# हैमी लाइफ क्लिनिकल स्क्रीनिंग: विस्तृत कार्यान्वयन योजना (Granular Implementation Plan)

यह दस्तावेज़ "Google/Meta" इंजीनियरिंग मानकों के अनुसार हैमी लाइफ (Haemi Life) प्लेटफॉर्म पर 'डायमंड' क्लिनिकल स्क्रीनिंग सिस्टम को जोड़ने का एक विस्तृत रोडमैप है।

---

## **0. संस्थागत कोडिंग और डिज़ाइन मानक (Institutional Coding & Design Standards)**

यह प्रोजेक्ट निम्नलिखित सख्त (Strict) मानकों का पालन करेगा:

### **A. डिज़ाइन और स्टाइलिंग (Premium Aesthetics):**
- **Zero Inline CSS:** कोई भी `style={{...}}` का उपयोग नहीं होगा। सभी स्टाइल्स `index.css` और Tailwind यूटिलिटी क्लासेस से आएंगे।
- **Institutional Colors:** सिर्फ प्रोजेक्ट गाइडलाइन के कलर्स का उपयोग (उदा: `primary-700`, `gray-900`)।
- **Micro-interactions:** Framer Motion का उपयोग करके "Smooth" और "Jitter-free" ट्रांजिशन। 
- **Theme Sync:** लाइट और डार्क मोड के लिए `var(--border)`, `var(--card)` जैसे वेरिएबल्स का उपयोग।

### **B. सख्त टाइपस्क्रिप्ट (Strict TypeScript):**
- **No 'any':** पूरे कोडबेस में `any` का उपयोग वर्जित है।
- **Type Narrowing:** जहाँ भी अनिश्चितता हो, `unknown` और `instanceof Error` जैसे पैटर्न्स का उपयोग।
- **No Double Casting:** `as unknown as Type` जैसे पैर्हसन से बचा जाएगा।

### **C. रोबस्ट लॉगिंग (Robust Logging):**
- हर डेटाबेस और API ऑपरेशन को `logger` के माध्यम से ट्रैक किया जाएगा।

---

## **1. डेटाबेस आर्किटेक्चर (The Holy Grail)**

- **Zero-Deletion Policy:** मौजूदा डेटा को बिना छुए, `screening_questions`, `patient_screening_records`, और `screening_responses` टेबल्स का निर्माण।
- **Naming:** Database (`snake_case`), JS/TS (`camelCase`)।

---

## **2. बैकएंड और लॉजिक (Backend - The Brain)**

- **Transactional Atomic commits:** `bookAppointment` के साथ स्क्रीनिंग रिकॉर्ड्स का सुरक्षित जुड़ाव।
- **API Endpoints:** पूरी तरह से टाइप्ड (Typed) और वैलिडेटेड (Zod) रिक्वेस्ट्स।

---

## **3. फ्रंटएंड और यूएक्स (Frontend & UX - Diamond Component)**

- **Premium Controls:** चेकबॉक्स और रेडियो बटन "Enterprise Grade" के होंगे।
- **Real-time Feedback:** जैसे ही मरीज सवाल भरेगा, रिस्क स्टेटस बिना पेज रिफ्रेश हुए अपडेट होगा।

---

## **4. एंड-टू-एंड डेटा प्रवाह (End-to-End Data Flow)**

- **Doctor Dashboard:** डॉक्टर को रिस्क बैज (Risk Badges) और विस्तृत "Forensic Screening Report" मिलेगी।

---

## **5. प्रभाव विश्लेषण तालिका (Impact Analysis Table)**

| कंपोनेंट | फाइल | विवरण |
| :--- | :--- | :--- |
| **Database** | `migrations/*.sql` | नए स्क्रीनिंग टेबल्स और इंडेक्स। |
| **Backend** | `screening.controller.ts` | strict TypeScript लॉजिक। |
| **Frontend** | `book-appointment.tsx` | प्रीमियम स्क्रीनिंग पैनल। |
| **Common** | `logger.ts` | सेंट्रलाइज्ड लॉगिंग। |

---

**हैमी लाइफ प्रॉमिस:** यह सिस्टम न केवल फंक्शनल होगा, बल्कि यह एक **"Google/Meta Premium"** अनुभव प्रदान करेगा।
