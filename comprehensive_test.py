#!/usr/bin/env python3
import json
import requests
import time

BASE_URL = "http://127.0.0.1:8000"

def test_study_ai():
    """Test StudyAI with various prompts"""
    url = f"{BASE_URL}/study-ai"
    session_id = "test-study-session-1"
    
    tests = [
        ("Who are you?", "Basic introduction"),
        ("Explain OOP for a beginner.", "Education - OOP"),
        ("Explain DBMS in simple terms.", "Education - DBMS"),
    ]
    
    print("=" * 80)
    print("TESTING STUDYAI")
    print("=" * 80)
    
    for prompt, description in tests:
        payload = {
            "message": prompt,
            "history": [],
            "session_id": session_id
        }
        
        print(f"\nTest: {description}")
        print(f"Prompt: {prompt}")
        print("-" * 40)
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                reply = data.get("reply", "")
                print(f"Response length: {len(reply)} chars")
                print(f"Response preview: {reply[:200]}...")
                print("✓ PASS")
            else:
                print(f"Error: {response.text[:200]}")
                print("✗ FAIL")
        except Exception as e:
            print(f"Error: {e}")
            print("✗ FAIL")
        
        time.sleep(1)

def test_life_ai():
    """Test LifeAI with various prompts"""
    url = f"{BASE_URL}/life-ai"
    
    tests = [
        ("Who are you?", "Basic introduction"),
        ("What is LifeAI?", "Self-description"),
        ("Help me create a daily routine.", "Life planning"),
    ]
    
    print("\n" + "=" * 80)
    print("TESTING LIFEAI")
    print("=" * 80)
    
    for prompt, description in tests:
        payload = {
            "message": prompt,
            "history": []
        }
        
        print(f"\nTest: {description}")
        print(f"Prompt: {prompt}")
        print("-" * 40)
        
        try:
            response = requests.post(url, json=payload, timeout=30)
            print(f"Status: {response.status_code}")
            
            if response.status_code == 200:
                data = response.json()
                reply = data.get("reply", "")
                print(f"Response length: {len(reply)} chars")
                print(f"Response preview: {reply[:200]}...")
                print("✓ PASS")
            else:
                print(f"Error: {response.text[:200]}")
                print("✗ FAIL")
        except Exception as e:
            print(f"Error: {e}")
            print("✗ FAIL")
        
        time.sleep(1)

def test_tailor_ai():
    """Test TailorAI for reference"""
    url = f"{BASE_URL}/tailor-ai"
    
    payload = {
        "message": "Who are you?",
        "history": [],
        "profile": None
    }
    
    print("\n" + "=" * 80)
    print("TESTING TAILORAI (Reference)")
    print("=" * 80)
    
    print("\nTest: Basic introduction")
    print("-" * 40)
    
    try:
        response = requests.post(url, json=payload, timeout=30)
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            reply = data.get("reply", "")
            print(f"Response length: {len(reply)} chars")
            print(f"Response preview: {reply[:200]}...")
            print("✓ PASS")
        else:
            print(f"Error: {response.text[:200]}")
            print("✗ FAIL")
    except Exception as e:
        print(f"Error: {e}")
        print("✗ FAIL")

def test_health():
    """Test health check"""
    print("\n" + "=" * 80)
    print("TESTING HEALTH CHECK")
    print("=" * 80)
    
    try:
        response = requests.get(f"{BASE_URL}/health", timeout=5)
        print(f"Status: {response.status_code}")
        data = response.json()
        print(f"Response: {json.dumps(data, indent=2)}")
        if response.status_code == 200:
            print("✓ PASS")
        else:
            print("✗ FAIL")
    except Exception as e:
        print(f"Error: {e}")
        print("✗ FAIL")

if __name__ == "__main__":
    test_health()
    test_tailor_ai()
    test_study_ai()
    test_life_ai()
    
    print("\n" + "=" * 80)
    print("TESTING COMPLETE")
    print("=" * 80)
