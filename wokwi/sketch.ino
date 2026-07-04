#define LIGHT1 23
#define LIGHT2 22
#define LIGHT3 21
#define FAN1 19
#define FAN2 18

void setup() {

  pinMode(LIGHT1, OUTPUT);
  pinMode(LIGHT2, OUTPUT);
  pinMode(LIGHT3, OUTPUT);
  pinMode(FAN1, OUTPUT);
  pinMode(FAN2, OUTPUT);

}

void loop() {

  digitalWrite(LIGHT1, HIGH);
  delay(500);

  digitalWrite(LIGHT2, HIGH);
  delay(500);

  digitalWrite(LIGHT3, HIGH);
  delay(500);

  digitalWrite(FAN1, HIGH);
  delay(500);

  digitalWrite(FAN2, HIGH);
  delay(500);

  digitalWrite(LIGHT1, LOW);
  delay(500);

  digitalWrite(LIGHT2, LOW);
  delay(500);

  digitalWrite(LIGHT3, LOW);
  delay(500);

  digitalWrite(FAN1, LOW);
  delay(500);

  digitalWrite(FAN2, LOW);
  delay(500);

}
