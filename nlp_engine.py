import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.naive_bayes import MultinomialNB

# Advanced dataset mapping symptoms to [Urgency, Department]
TRAINING_DATA = [
    # Cardiology
    ("severe chest pain crushing sensation", "High", "Cardiology"),
    ("heart attack symptoms left arm pain pressure", "High", "Cardiology"),
    ("irregular heartbeat palpitations shortness of breath", "Medium", "Cardiology"),
    ("high blood pressure dizziness headache", "Medium", "Cardiology"),
    ("chronic mild hypertension monitoring", "Low", "Cardiology"),
    
    # Pulmonology / Respiratory
    ("severe breathing difficulty asthma attack cyanosis", "High", "Pulmonology"),
    ("chronic shortness of breath wheezing cough", "Medium", "Pulmonology"),
    ("persistent coughing with blood", "High", "Pulmonology"),
    ("mild chest congestion coughing", "Low", "Pulmonology"),
    ("seasonal allergy breathing discomfort", "Low", "Pulmonology"),
    
    # Orthopedics
    ("compound bone fracture leg deformity bleeding", "High", "Orthopedics"),
    ("broken arm severe joint pain swelling", "Medium", "Orthopedics"),
    ("severe lower back pain unable to stand", "Medium", "Orthopedics"),
    ("sprained ankle swelling mild pain", "Low", "Orthopedics"),
    ("chronic knee pain arthritis checkup", "Low", "Orthopedics"),

    # Pediatrics
    ("child high fever unresponsive fits", "High", "Pediatrics"),
    ("baby crying uncontrollably high temperature", "High", "Pediatrics"),
    ("infant vomiting dehydration", "Medium", "Pediatrics"),
    ("pediatric mild skin rash spots", "Low", "Pediatrics"),
    ("child routine school checkup vaccination", "Low", "Pediatrics"),

    # General Medicine / Others
    ("severe abdominal pain appendix symptoms", "High", "General Medicine"),
    ("high fever vomiting and body weakness", "Medium", "General Medicine"),
    ("migraine headache light sensitivity", "Medium", "General Medicine"),
    ("common cold sore throat minor fever", "Low", "General Medicine"),
    ("mild stomach ache acid reflux", "Low", "General Medicine"),
    ("minor cut skin abrasion", "Low", "General Medicine")
]

# Separate texts, urgencies, and departments
texts = [item[0] for item in TRAINING_DATA]
urgencies = [item[1] for item in TRAINING_DATA]
departments = [item[2] for item in TRAINING_DATA]

# Vectorizer & Models
vectorizer = TfidfVectorizer(lowercase=True, stop_words="english", ngram_range=(1, 2))
X = vectorizer.fit_transform(texts)

urgency_model = MultinomialNB(alpha=0.1)
urgency_model.fit(X, urgencies)

dept_model = MultinomialNB(alpha=0.1)
dept_model.fit(X, departments)

def predict_symptoms(symptoms_text):
    """
    Predicts urgency level and appropriate department based on symptoms text.
    """
    if not symptoms_text or len(symptoms_text.strip()) == 0:
        return "Low", "General Medicine"
    
    x = vectorizer.transform([symptoms_text.lower()])
    
    # Predict urgency
    urgency = urgency_model.predict(x)[0]
    
    # Predict department
    department = dept_model.predict(x)[0]
    
    # Rule-based emergency overrides for security
    symptoms_lower = symptoms_text.lower()
    critical_keywords = ["chest pain", "heart attack", "unresponsive", "fits", "seizure", "bleeding out", "difficulty breathing", "choking"]
    if any(keyword in symptoms_lower for keyword in critical_keywords):
        urgency = "High"
        if any(h in symptoms_lower for h in ["chest", "heart", "cardio", "palpitation"]):
            department = "Cardiology"
        elif any(r in symptoms_lower for r in ["breath", "lung", "asthma", "cough"]):
            department = "Pulmonology"
            
    return urgency, department

if __name__ == "__main__":
    # Self-test
    test_cases = [
        "I have sudden chest pain and pressure in my left arm",
        "My child has a very high fever and is vomiting",
        "Just a minor cold and headache",
        "Broken bone after falling down the stairs"
    ]
    for case in test_cases:
        urg, dept = predict_symptoms(case)
        print(f"Symptoms: '{case}' -> Urgency: {urg}, Department: {dept}")
