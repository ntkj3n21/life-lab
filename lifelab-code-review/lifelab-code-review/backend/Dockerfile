FROM maven:3.9-eclipse-temurin-17 AS build

WORKDIR /workspace

COPY pom.xml ./
RUN mvn -B -DskipTests dependency:go-offline

COPY src ./src
RUN mvn -B -DskipTests package

FROM eclipse-temurin:17-jre-alpine

WORKDIR /app

RUN addgroup -S lifelab \
    && adduser -S -G lifelab lifelab

COPY --from=build /workspace/target/*.jar /app/app.jar

USER lifelab

EXPOSE 8080

ENTRYPOINT ["java", "-jar", "/app/app.jar"]
