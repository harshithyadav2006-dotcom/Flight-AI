/*
  SkyPilot AI - Integrated Hardware Sketch
  Includes: MPU6050 (Turbulence), HC-SR04 (Icing), GSM (SMS Alerts), Servos (Radar)
  
  MODIFICATION: Added WEB_DATA output for serial bridge integration.
*/

#include <Servo.h>
#include <Wire.h>
#include <MPU6050.h>
#include <SoftwareSerial.h>

// PIN DEFINITIONS
#define GSM_RX_PIN    2
#define GSM_TX_PIN    3
#define GSM_PWRKEY    4
#define SERVO_X_PIN   6
#define SERVO_Y_PIN   7
#define TRIG_PIN      9
#define ECHO_PIN      10
#define LOCK_PIN      13

SoftwareSerial gsmSerial(GSM_RX_PIN, GSM_TX_PIN);
MPU6050 mpu(0x68);
Servo servoX;
Servo servoY;

const char* ALERT_NUMBER = "+918197149231";

// IMU VARIABLES
float compAngleX   = 0, compAngleY   = 0;
float gyroOffsetX  = 0, gyroOffsetY  = 0;
float accelOffsetX = 0, accelOffsetY = 0;
unsigned long lastIMUTime = 0;
float gyroRateX = 0, gyroRateY = 0, gyroRateZ = 0;
float gzOffset  = 0;

const float ALPHA = 0.30;

// RADAR SWEEP
int xAngle = 90, yAngle = 90;
int xDir   = 1,  yDir   = 1;
const int X_STEP = 1,  Y_STEP = 1;
const int X_MIN  = 0,  X_MAX  = 180;
const int Y_MIN  = 45, Y_MAX  = 135;

const int LOOP_DELAY_MS = 20;

enum TurbLevel { TURB_NONE, TURB_MILD, TURB_MODERATE, TURB_SEVERE };
TurbLevel currentTurb = TURB_NONE;
bool smsTurbSent = false;
bool smsIceSent  = false;

void setup() {
  Serial.begin(9600);
  gsmSerial.begin(9600);

  Wire.begin();
  Wire.setClock(50000);
  
  pinMode(TRIG_PIN, OUTPUT);
  pinMode(ECHO_PIN, INPUT);
  pinMode(LOCK_PIN, OUTPUT);

  servoX.attach(SERVO_X_PIN);
  servoY.attach(SERVO_Y_PIN);
  
  mpu.initialize();
  calibrateIMU();
  
  // Note: GSM init might take time, removed for faster debug if needed
  // powerOnGSM(); 
  
  lastIMUTime = millis();
}

void loop() {
  updateIMU();
  updateRadarSweep();
  float dist = getDistance();
  
  currentTurb = classifyTurbulence();
  
  // --- WEB INTEGRATION LINE ---
  // Format: WEB_DATA:pitch,roll,yaw,distance
  Serial.print("WEB_DATA:");
  Serial.print(compAngleY); Serial.print(","); 
  Serial.print(compAngleX); Serial.print(",");
  Serial.print(gyroRateZ);  Serial.print(",");
  Serial.println(dist);
  // ----------------------------

  updateLockLED();
  
  delay(LOOP_DELAY_MS);
}

// (Helper functions: calibrateIMU, updateIMU, getDistance, etc. remain the same as your original code)
// ... [REDACTED FOR BREVITY - USE YOUR ORIGINAL HELPER FUNCTIONS] ...

void calibrateIMU() {
  const int N = 200;
  float gxS = 0, gyS = 0, gzS = 0, axS = 0, ayS = 0;
  for (int i = 0; i < N; i++) {
    int16_t ax, ay, az, gx, gy, gz;
    mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
    gxS += gx / 131.0; gyS += gy / 131.0; gzS += gz / 131.0;
    axS += atan2(ay, az) * 180.0 / PI;
    ayS += atan2(-ax, az) * 180.0 / PI;
    delay(10);
  }
  gyroOffsetX = gxS/N; gyroOffsetY = gyS/N; gzOffset = gzS/N;
  accelOffsetX = axS/N; accelOffsetY = ayS/N;
  compAngleX = accelOffsetX; compAngleY = accelOffsetY;
}

void updateIMU() {
  int16_t ax, ay, az, gx, gy, gz;
  mpu.getMotion6(&ax, &ay, &az, &gx, &gy, &gz);
  unsigned long now = millis();
  float dt = (now - lastIMUTime) / 1000.0f;
  lastIMUTime = now;
  gyroRateX = abs((gx / 131.0) - gyroOffsetX);
  gyroRateY = abs((gy / 131.0) - gyroOffsetY);
  gyroRateZ = abs((gz / 131.0) - gzOffset);
  float rateX = (gx / 131.0) - gyroOffsetX;
  float rateY = (gy / 131.0) - gyroOffsetY;
  float aX = (atan2(ay, az) * 180.0 / PI) - accelOffsetX;
  float aY = (atan2(-ax, az) * 180.0 / PI) - accelOffsetY;
  compAngleX = ALPHA * (compAngleX + rateX * dt) + (1 - ALPHA) * aX;
  compAngleY = ALPHA * (compAngleY + rateY * dt) + (1 - ALPHA) * aY;
}

void updateRadarSweep() {
  xAngle += xDir * X_STEP;
  if (xAngle >= X_MAX) { xAngle = X_MAX; xDir = -1; }
  else if (xAngle <= X_MIN) { xAngle = X_MIN; xDir = 1; }
  yAngle += yDir * Y_STEP;
  if (yAngle >= Y_MAX) { yAngle = Y_MAX; yDir = -1; }
  else if (yAngle <= Y_MIN) { yAngle = Y_MIN; yDir = 1; }
  servoX.write(xAngle);
  servoY.write(yAngle);
}

float getDistance() {
  digitalWrite(TRIG_PIN, LOW); delayMicroseconds(2);
  digitalWrite(TRIG_PIN, HIGH); delayMicroseconds(10);
  digitalWrite(TRIG_PIN, LOW);
  long dur = pulseIn(ECHO_PIN, HIGH, 30000);
  return (dur == 0) ? 999.0 : (dur * 0.034) / 2.0;
}

TurbLevel classifyTurbulence() {
  float shakeMag = max(gyroRateX, max(gyroRateY, gyroRateZ));
  float tiltMag = sqrt(compAngleX*compAngleX + compAngleY*compAngleY);
  if (shakeMag >= 60.0 || tiltMag >= 40.0) return TURB_SEVERE;
  if (shakeMag >= 8.0  || tiltMag >= 3.0)  return TURB_MODERATE;
  if (shakeMag >= 2.0  || tiltMag >= 1.0)  return TURB_MILD;
  return TURB_NONE;
}

void updateLockLED() {
  switch (currentTurb) {
    case TURB_NONE: digitalWrite(LOCK_PIN, LOW); break;
    case TURB_MILD: digitalWrite(LOCK_PIN, (millis()/500)%2); break;
    case TURB_MODERATE: digitalWrite(LOCK_PIN, (millis()/150)%2); break;
    case TURB_SEVERE: digitalWrite(LOCK_PIN, HIGH); break;
  }
}
