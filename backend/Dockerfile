FROM maven:3.9-eclipse-temurin-21 AS build
WORKDIR /build
COPY pom.xml ./
RUN --mount=type=secret,id=maven_settings,target=/root/.m2/settings.xml \
    mvn -B -ntp -Dmaven.repo.local=/root/.m2/repository dependency:go-offline
COPY src ./src
RUN --mount=type=secret,id=maven_settings,target=/root/.m2/settings.xml \
    mvn -B -ntp -Dmaven.repo.local=/root/.m2/repository -DskipTests package

FROM eclipse-temurin:21-jre
ENV TZ=UTC
WORKDIR /app
RUN command -v curl \
    && groupadd --system studio \
    && useradd --system --gid studio --home-dir /app studio \
    && mkdir -p /data \
    && chown studio:studio /app /data
COPY --from=build --chown=studio:studio /build/target/studio-0.0.1-SNAPSHOT.jar /app/studio.jar
USER studio
EXPOSE 8080
ENTRYPOINT ["java", "-jar", "/app/studio.jar"]
