use super::gen_key;

#[test]
fn gen_key_matches_websocket_example() {
    let client_key = String::from("dGhlIHNhbXBsZSBub25jZQ==");

    let accept_key = gen_key(&client_key);

    assert_eq!(accept_key, "s3pPLMBiTxaQ9kYGzzhZRbK+xOo=");
}

#[test]
fn gen_key_changes_when_client_key_changes() {
    let first_key = String::from("first-key");
    let second_key = String::from("second-key");

    assert_ne!(gen_key(&first_key), gen_key(&second_key));
}
