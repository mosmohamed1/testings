from os.path import exists, join
from flask import send_from_directory
from flask import Flask, jsonify, send_from_directory
from flask import jsonify
import os
import io
import mimetypes
import time
import logging
import openai
import psycopg2


from flask import Flask, request, jsonify, send_file, abort, render_template, redirect, url_for, session, send_from_directory
from azure.identity import DefaultAzureCredential
from azure.search.documents import SearchClient
from approaches.retrievethenread import RetrieveThenReadApproach
from approaches.readretrieveread import ReadRetrieveReadApproach
from approaches.readdecomposeask import ReadDecomposeAsk
from approaches.chatreadretrieveread import ChatReadRetrieveReadApproach
from azure.storage.blob import BlobServiceClient
from model import db, User, ModelInfo
from config import ApplicationConfig
from flask_bcrypt import Bcrypt
from flask_session import Session
from flask_cors import CORS, cross_origin
from werkzeug.utils import secure_filename


app = Flask(__name__)
app.config.from_object(ApplicationConfig)
bcrypt = Bcrypt(app)
CORS(app, supports_credentials=True)
server_session = Session(app)

db.init_app(app)
with app.app_context():
    db.create_all()


# Replace these with your own values, either in environment variables or directly here
AZURE_STORAGE_ACCOUNT = os.environ.get(
    "AZURE_STORAGE_ACCOUNT") or "mystorageaccount"
AZURE_STORAGE_CONTAINER = os.environ.get(
    "AZURE_STORAGE_CONTAINER") or "content"
AZURE_SEARCH_SERVICE = os.environ.get("AZURE_SEARCH_SERVICE") or "gptkb"
AZURE_SEARCH_INDEX = os.environ.get("AZURE_SEARCH_INDEX") or "gptkbindex"
AZURE_OPENAI_SERVICE = os.environ.get("AZURE_OPENAI_SERVICE") or "myopenai"
AZURE_OPENAI_GPT_DEPLOYMENT = os.environ.get(
    "AZURE_OPENAI_GPT_DEPLOYMENT") or "davinci"
AZURE_OPENAI_CHATGPT_DEPLOYMENT = os.environ.get(
    "AZURE_OPENAI_CHATGPT_DEPLOYMENT") or "chat"
AZURE_OPENAI_CHATGPT_MODEL = os.environ.get(
    "AZURE_OPENAI_CHATGPT_MODEL") or "gpt-35-turbo"

KB_FIELDS_CONTENT = os.environ.get("KB_FIELDS_CONTENT") or "content"
KB_FIELDS_CATEGORY = os.environ.get("KB_FIELDS_CATEGORY") or "category"
KB_FIELDS_SOURCEPAGE = os.environ.get("KB_FIELDS_SOURCEPAGE") or "sourcepage"

# Use the current user identity to authenticate with Azure OpenAI, Cognitive Search and Blob Storage (no secrets needed,
# just use 'az login' locally, and managed identity when deployed on Azure). If you need to use keys, use separate AzureKeyCredential instances with the
# keys for each service
# If you encounter a blocking error during a DefaultAzureCredntial resolution, you can exclude the problematic credential by using a parameter (ex. exclude_shared_token_cache_credential=True)
azure_credential = DefaultAzureCredential()

# Used by the OpenAI SDK
openai.api_type = "azure"
openai.api_base = f"https://{AZURE_OPENAI_SERVICE}.openai.azure.com"
openai.api_version = "2023-05-15"

# Comment these two lines out if using keys, set your API key in the OPENAI_API_KEY environment variable instead
openai.api_type = "azure_ad"
openai_token = azure_credential.get_token(
    "https://cognitiveservices.azure.com/.default")
openai.api_key = openai_token.token

# Set up clients for Cognitive Search and Storage
search_client = SearchClient(
    endpoint=f"https://{AZURE_SEARCH_SERVICE}.search.windows.net",
    index_name=AZURE_SEARCH_INDEX,
    credential=azure_credential)
blob_client = BlobServiceClient(
    account_url=f"https://{AZURE_STORAGE_ACCOUNT}.blob.core.windows.net",
    credential=azure_credential)
blob_container = blob_client.get_container_client(AZURE_STORAGE_CONTAINER)

# Various approaches to integrate GPT and external knowledge, most applications will use a single one of these patterns
# or some derivative, here we include several for exploration purposes
ask_approaches = {
    "rtr": RetrieveThenReadApproach(search_client, AZURE_OPENAI_GPT_DEPLOYMENT, KB_FIELDS_SOURCEPAGE, KB_FIELDS_CONTENT),
    "rrr": ReadRetrieveReadApproach(search_client, AZURE_OPENAI_GPT_DEPLOYMENT, KB_FIELDS_SOURCEPAGE, KB_FIELDS_CONTENT),
    "rda": ReadDecomposeAsk(search_client, AZURE_OPENAI_GPT_DEPLOYMENT, KB_FIELDS_SOURCEPAGE, KB_FIELDS_CONTENT)
}

chat_approaches = {
    "rrr": ChatReadRetrieveReadApproach(search_client, AZURE_OPENAI_CHATGPT_DEPLOYMENT, AZURE_OPENAI_CHATGPT_MODEL, AZURE_OPENAI_GPT_DEPLOYMENT, KB_FIELDS_SOURCEPAGE, KB_FIELDS_CONTENT)
}


@app.route("/", defaults={"path": "index.html"})
@app.route("/<path:path>")
def static_file(path):
    return app.send_static_file(path)


# Serve content files from blob storage from within the app to keep the example self-contained.
# *** NOTE *** this assumes that the content files are public, or at least that all users of the app
# can access all the files. This is also slow and memory hungry.


@app.route("/content/<path>")
def content_file(path):
    blob = blob_container.get_blob_client(path).download_blob()
    if not blob.properties or not blob.properties.has_key("content_settings"):
        abort(404)
    mime_type = blob.properties["content_settings"]["content_type"]
    if mime_type == "application/octet-stream":
        mime_type = mimetypes.guess_type(path)[0] or "application/octet-stream"
    blob_file = io.BytesIO()
    blob.readinto(blob_file)
    blob_file.seek(0)
    return send_file(blob_file, mimetype=mime_type, as_attachment=False, download_name=path)


@app.route("/@me")
def get_current_user():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    user = User.query.filter_by(id=user_id).first()
    return jsonify({
        "id": user.id,
        "email": user.email,
        "firstName": user.firstName,
        "lastName": user.lastName,
        "companyName": user.companyName,
        "title": user.title

    })


@app.route("/register", methods=["POST"])
def register_user():
    email = request.json["email"]
    password = request.json["password"]
    firstName = request.json["firstName"]
    lastName = request.json["lastName"]
    companyName = request.json["companyName"]
    title = request.json["title"]

    errors = []

    if not firstName:
        return jsonify({"error": "First name is required"}), 400
    if not lastName:
        return jsonify({"error": "Last name is required"}), 400
    if not companyName:
        return jsonify({"error": "Company name is required"}), 400
    if not title:
        return jsonify({"error": "Title is required"}), 400
    if not email:
        return jsonify({"error": "Email is required"}), 400
    if not password:
        return jsonify({"error": "Password is required"}), 400

    user_exists = User.query.filter_by(email=email).first() is not None
    if user_exists:
        return jsonify({"error": "User already exists"}), 409

    if errors:
        return jsonify({"error": errors}), 400

    hashed_password = bcrypt.generate_password_hash(password)
    new_user = User(email=email, password=hashed_password, firstName=firstName,
                    lastName=lastName, companyName=companyName, title=title)
    db.session.add(new_user)
    db.session.commit()

    session["user_id"] = new_user.id

    return jsonify({
        "id": new_user.id,
        "email": new_user.email,
        "firstName": new_user.firstName,
        "lastName": new_user.lastName,
        "companyName": new_user.companyName,
        "title": new_user.title
    })


@app.route("/login", methods=["POST"])
def login_user():
    email = request.json["email"]
    password = request.json["password"]

    user = User.query.filter_by(email=email).first()

    if user is None:
        return jsonify({"error": "Unauthorized"}), 401

    if not bcrypt.check_password_hash(user.password, password):
        return jsonify({"error": "Unauthorized"}), 401

    session["user_id"] = user.id

    return jsonify({
        "id": user.id,
        "email": user.email
    })


@app.route("/logout", methods=["POST"])
def logout_user():
    session.pop("user_id")
    return "200"


@app.route("/update_profile", methods=["POST"])
def update_profile():
    user_id = session.get("user_id")

    if not user_id:
        return jsonify({"error": "Unauthorized"}), 401

    user = User.query.filter_by(id=user_id).first()

    if not user:
        return jsonify({"error": "User not found"}), 404

    user.firstName = request.json.get("firstName", user.firstName)
    user.lastName = request.json.get("lastName", user.lastName)
    user.email = request.json.get("email", user.email)
    user.companyName = request.json.get("companyName", user.companyName)
    user.title = request.json.get("title", user.title)

    db.session.commit()

    return jsonify({"message": "Profile updated successfully"})


@app.route("/list_pdf_files", methods=["GET"])
def list_pdf_files():
    directory = os.path.join(os.path.dirname(__file__), '..', '..', 'data')

    files = [f for f in os.listdir(directory) if f.endswith('.pdf')]
    return jsonify(files)


@app.route("/add_pdf_file", methods=["POST"])
def add_pdf_file():
    uploaded_file = request.files['file']

    if uploaded_file.filename != '' and uploaded_file.filename.endswith('.pdf'):
        filename = secure_filename(uploaded_file.filename)

        path = os.path.join(os.path.dirname(__file__),
                            '..', '..', 'data', filename)

        uploaded_file.save(path)
        return jsonify({"message": "File uploaded successfully"}), 200
    else:
        return jsonify({"error": "Invalid file"}), 400


@app.route("/remove_pdf_file", methods=["DELETE"])
def remove_pdf_file():
    file_name = request.json["file_name"]
    path = os.path.join(os.path.dirname(__file__),
                        '..', '..', 'data', file_name)

    if os.path.exists(path):
        os.remove(path)
        return jsonify({"message": f"{file_name} removed successfully"}), 200
    else:
        return jsonify({"error": f"{file_name} not found."}), 400


@app.route("/rename_pdf_file", methods=["PUT"])
def rename_pdf_file():
    original_name = request.json["original_name"]
    new_name = request.json["new_name"]

    BASE_DIRECTORY = os.path.join(
        os.path.dirname(__file__), '..', '..', 'data')

    original_path = os.path.join(BASE_DIRECTORY, original_name)
    new_path = os.path.join(BASE_DIRECTORY, new_name)

    if os.path.exists(original_path):
        try:
            os.rename(original_path, new_path)
            return jsonify({"message": "File renamed successfully"}), 200
        except Exception as e:
            return jsonify({"error": str(e)}), 500
    else:
        return jsonify({"error": f"File {original_name} does not exist!"}), 400


@app.route('/models', methods=['GET'])
def get_models():
    try:
        current_dir = os.path.dirname(os.path.realpath(__file__))

        model_dir = os.path.join(
            current_dir, "..", "frontend", "public", "models")

        all_files = os.listdir(model_dir)

        stl_files = [f for f in all_files if f.lower().endswith('.stl')]

        print(stl_files)
        return jsonify(stl_files)
    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


MODEL_UPLOAD_FOLDER = os.path.join(os.path.dirname(
    os.path.realpath(__file__)), "..", "frontend", "public", "models")
app.config['MODEL_UPLOAD_FOLDER'] = MODEL_UPLOAD_FOLDER

BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMAGE_UPLOAD_FOLDER = os.path.join(BASE_DIR, 'frontend', 'public', 'modelicon')
app.config['IMAGE_UPLOAD_FOLDER'] = IMAGE_UPLOAD_FOLDER

ALLOWED_EXTENSIONS = {
    'model': set(['stl']),
    'image': set(['jpg', 'jpeg', 'png'])
}


def allowed_file(filename, file_type):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS[file_type]


@app.route('/models/<filename>', methods=['GET'])
def serve_model(filename):
    return send_from_directory(app.config['MODEL_UPLOAD_FOLDER'], filename)


@app.route('/upload', methods=['POST'])
def upload_file():
    print("Upload endpoint called")

    file_type = request.args.get('type', 'model')

    if file_type not in ['model', 'image']:
        return jsonify({"error": "Invalid file type parameter"}), 400

    if file_type not in request.files:
        return jsonify({"error": f"No {file_type} file part"}), 400

    file = request.files[file_type]

    if file.filename == '':
        return jsonify({"error": "No selected file"}), 400

    if not allowed_file(file.filename, file_type):
        return jsonify({"error": f"Invalid {file_type} type. Allowed extensions: {', '.join(ALLOWED_EXTENSIONS[file_type])}"}), 400

    filename = secure_filename(file.filename)

    if file_type == 'model':
        folder = app.config['MODEL_UPLOAD_FOLDER']
    else:
        folder = app.config['IMAGE_UPLOAD_FOLDER']

    file_path = os.path.join(folder, filename)

    if os.path.exists(file_path):
        return jsonify({"error": "File with the same name already exists!"}), 400

    file.save(file_path)
    print(f"{file_type.capitalize()} {filename} saved successfully")
    return jsonify({"success": True, "filename": filename}), 200


@app.route('/delete', methods=['DELETE'])
def delete_file():
    file_type = request.args.get('type')
    file_name = request.args.get('filename')

    if not file_type or not file_name:
        return jsonify({"error": "Invalid request parameters"}), 400

    if file_type == 'model':
        file_path = os.path.join(app.config['MODEL_UPLOAD_FOLDER'], file_name)
    elif file_type == 'image':
        file_path = os.path.join(app.config['IMAGE_UPLOAD_FOLDER'], file_name)
    else:
        return jsonify({"error": "Unsupported file type"}), 400

    if os.path.exists(file_path):
        os.remove(file_path)
        return jsonify({"success": True}), 200
    else:
        return jsonify({"error": f"{file_type.capitalize()} not found"}), 404


@app.route('/delete_model_info', methods=['DELETE'])
def delete_model_info():
    try:
        model_name = request.args.get('model_name')
        if not model_name:
            return jsonify({"error": "No model_name provided"}), 400

        model_info = ModelInfo.query.filter_by(modelName=model_name).first()
        if not model_info:
            return jsonify({"error": "Model info not found"}), 404

        db.session.delete(model_info)
        db.session.commit()
        return jsonify({"success": True, "message": "Model info deleted successfully"}), 200

    except Exception as e:
        print(f"Error: {e}")
        return jsonify({"error": str(e)}), 500


@app.route('/add_model_info', methods=['POST'])
def add_model_info():
    data = request.json
    print("Received data:", data)

    model_info = ModelInfo(
        modelName=data.get('model_name', ''),
        imageName=data.get('image_name', ''),
        focusWords=",".join(data.get('focus_keywords', [])),
        pdfFileNames=",".join(data.get('pdf_file_names', []))
    )
    db.session.add(model_info)
    db.session.commit()
    return jsonify({"message": "Model info added successfully!"}), 201


@app.route('/get_model_infos', methods=['GET'])
def get_model_infos():
    all_info = ModelInfo.query.all()
    return jsonify([
        {
            "model_name": info.modelName,
            "image_name": info.imageName,
            "focus_keywords": info.focusWords.split(","),
            "pdf_file_names": info.pdfFileNames.split(",")
        }
        for info in all_info
    ]), 200


@app.route('/get_specific_model_info/<model_name>', methods=['GET'])
def get_specific_model_info(model_name):
    info = ModelInfo.query.filter_by(modelName=model_name).first()

    if not info:
        return jsonify({"message": "Model not found"}), 404

    return jsonify({
        "model_name": info.modelName,
        "image_name": info.imageName,
        "focus_keywords": info.focusWords.split(","),
        "pdf_file_names": info.pdfFileNames.split(",")
    }), 200


@app.route("/ask", methods=["POST"])
def ask():
    ensure_openai_token()
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    approach = request.json["approach"]
    try:
        impl = ask_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        r = impl.run(request.json["question"],
                     request.json.get("overrides") or {})
        print(r)

        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /ask")
        return jsonify({"error": str(e)}), 500


@app.route("/chat", methods=["POST"])
def chat():
    ensure_openai_token()
    if not request.json:
        return jsonify({"error": "request must be json"}), 400
    approach = request.json["approach"]
    try:
        impl = chat_approaches.get(approach)
        if not impl:
            return jsonify({"error": "unknown approach"}), 400
        # print(request.json["history"])
        r = impl.run(request.json["history"],
                     request.json.get("overrides") or {})

        return jsonify(r)
    except Exception as e:
        logging.exception("Exception in /chat")
        return jsonify({"error": str(e)}), 500


def ensure_openai_token():
    global openai_token
    if openai_token.expires_on < int(time.time()) - 60:
        openai_token = azure_credential.get_token(
            "https://cognitiveservices.azure.com/.default")
        openai.api_key = openai_token.token


if __name__ == "__main__":
    app.run()
