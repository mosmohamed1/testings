from flask_sqlalchemy import SQLAlchemy
from uuid import uuid4

db = SQLAlchemy()


def get_uuid():
    return uuid4().hex


class User(db.Model):
    __tablename__ = "users"
    id = db.Column(db.String(32), primary_key=True,
                   unique=True, default=get_uuid)
    email = db.Column(db.String(345), unique=True)
    password = db.Column(db.Text, nullable=False)
    firstName = db.Column(db.String(100), nullable=True)
    lastName = db.Column(db.String(100), nullable=True)
    companyName = db.Column(db.String(100), nullable=True)
    title = db.Column(db.String(100), nullable=True)


class ModelInfo(db.Model):
    __tablename__ = "models"

    id = db.Column(db.Integer, primary_key=True, autoincrement=True)
    modelName = db.Column(db.String, nullable=True)
    imageName = db.Column(db.String, nullable=True)
    focusWords = db.Column(db.Text)
    pdfFileNames = db.Column(db.Text)
